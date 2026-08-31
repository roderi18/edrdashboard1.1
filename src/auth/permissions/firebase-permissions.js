import {
  doc,
  query,
  getDoc,
  setDoc,
  getDocs,
  orderBy,
  writeBatch,
  collection,
  serverTimestamp,
} from 'firebase/firestore';

import { AUTH, FIRESTORE, isFirebaseConfigured } from 'src/lib/firebase';

import { ROLES_CATALOGO } from './roles';
import { crearDefinicionRol } from './role-permissions';
import { PERMISOS_CATALOGO, COLECCIONES_AUTORIZACION } from './permissions';

const assertFirebase = () => {
  if (!isFirebaseConfigured || !FIRESTORE) {
    throw new Error('Firebase no esta configurado para autorizacion.');
  }
};

const withTimestamps = (payload = {}) => ({
  ...payload,
  activo: payload.activo ?? true,
  actualizadoEnServidor: serverTimestamp(),
});

export async function sincronizarCatalogoAutorizacion({ usuario = null } = {}) {
  assertFirebase();

  const batch = writeBatch(FIRESTORE);

  PERMISOS_CATALOGO.forEach((permiso) => {
    batch.set(
      doc(FIRESTORE, COLECCIONES_AUTORIZACION.permisos, permiso.codigo),
      withTimestamps({
        ...permiso,
        creadoPor: usuario?.uid || usuario?.email || 'sistema',
      }),
      { merge: true }
    );
  });

  ROLES_CATALOGO.map(crearDefinicionRol).forEach((rol) => {
    batch.set(
      doc(FIRESTORE, COLECCIONES_AUTORIZACION.roles, rol.codigo),
      withTimestamps({
        ...rol,
        creadoPor: usuario?.uid || usuario?.email || 'sistema',
      }),
      { merge: true }
    );
  });

  await batch.commit();

  return {
    permisos: PERMISOS_CATALOGO.length,
    roles: ROLES_CATALOGO.length,
  };
}

export async function obtenerRolAutorizacion(rolId) {
  assertFirebase();

  if (!rolId) return null;

  const snapshot = await getDoc(doc(FIRESTORE, COLECCIONES_AUTORIZACION.roles, String(rolId)));

  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}

export async function obtenerCatalogoPermisos() {
  assertFirebase();

  const snapshot = await getDocs(
    query(collection(FIRESTORE, COLECCIONES_AUTORIZACION.permisos), orderBy('modulo', 'asc'))
  );

  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

export async function obtenerRolesAutorizacion() {
  assertFirebase();

  const snapshot = await getDocs(collection(FIRESTORE, COLECCIONES_AUTORIZACION.roles));

  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

export async function obtenerAsignacionRolUsuario(uidUsuario) {
  assertFirebase();

  if (!uidUsuario) return null;

  const snapshot = await getDoc(
    doc(FIRESTORE, COLECCIONES_AUTORIZACION.usuariosRoles, String(uidUsuario))
  );

  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}

export async function obtenerAccesoUsuario(uidUsuario) {
  const asignacion = await obtenerAsignacionRolUsuario(uidUsuario);

  if (!asignacion?.rolId) return asignacion;

  const rol = await obtenerRolAutorizacion(asignacion.rolId);
  const permisosDirectos = asignacion?.permisos || [];
  const permisosExcluidos = asignacion?.permisosExcluidos || [];
  const permisosMetadata = asignacion?.permisosMetadata || {};

  return {
    ...asignacion,
    rol,
    permisosDirectos,
    permisosExcluidos,
    permisosMetadata,
    permisos: Array.from(new Set([...(rol?.permisos || []), ...permisosDirectos])).filter(
      (permiso) => !permisosExcluidos.includes(permiso)
    ),
    restricciones: {
      ...(rol?.restricciones || {}),
      ...(asignacion?.restricciones || {}),
    },
  };
}

export async function guardarAsignacionRolUsuario({
  uidUsuario,
  correo = '',
  nombre = '',
  rolId,
  rolNombre = '',
  alcance = {},
  restricciones = {},
  usuario = null,
  // Los OTROS cargos que ejerce a la vez. El rol principal es uno solo —con el
  // entra—, pero quien ocupa una casilla en su destacamento y otra en su seccion
  // ejerce las dos, y los guardas preguntan por todas (`rolesQueEjerce`). Una
  // lista vacia las borra, que es lo que hace falta al volver a un rol suelto.
  cargos = null,
  // Marca de que la sesion es una PRUEBA del Administrador Global: con que rol
  // real volver cuando la apague. Sin ella, al entrar como otro cargo perdia el
  // boton para regresar.
  simulacion = null,
} = {}) {
  assertFirebase();

  if (!uidUsuario) {
    throw new Error('uidUsuario es requerido para guardar la asignacion de rol.');
  }

  if (!rolId) {
    throw new Error('rolId es requerido para guardar la asignacion de rol.');
  }

  const payload = withTimestamps({
    uidUsuario,
    correo,
    nombre,
    rolId,
    rolNombre,
    alcance,
    restricciones,
    ...(Array.isArray(cargos) ? { cargos } : {}),
    ...(simulacion === null ? {} : { simulacion }),
    activo: true,
    asignadoPor: usuario?.uid || usuario?.email || 'sistema',
    asignadoEn: new Date().toISOString(),
  });

  await setDoc(doc(FIRESTORE, COLECCIONES_AUTORIZACION.usuariosRoles, String(uidUsuario)), payload, {
    merge: true,
  });

  return payload;
}

/**
 * Le cuenta al SERVIDOR que cargo ocupa quien acaba de entrar.
 *
 * La sesion deduce el rol de sus casillas en la directiva, pero eso vivia solo
 * en el navegador: en Firestore la mayoria de las cuentas no tenian `rolId`, y
 * las reglas —que preguntan por `usuarios_roles/<uid>`— no encontraban ni el
 * documento. Por ahi se caia, por ejemplo, subir la foto de un miembro del
 * propio destacamento: la pantalla lo ofrecia y el servidor lo rechazaba.
 *
 * No concede nada: el rol sale de las asignaciones reales y cada quien solo se
 * sincroniza a si mismo. Va sin bloquear y sin recargar; si el servidor de
 * administracion no esta configurado responde 503 y no pasa nada.
 */
// Una vez por sesion y no una por refresco de token. Se llamaba en CADA
// resolucion —y el token cambia varias veces al entrar—, asi que la misma
// sincronizacion salia tres y cuatro veces seguidas, tardando segundos cada una.
// No cambia nada de lo que se ve: solo alinea al servidor con el cargo que la
// sesion ya resolvio.
const yaSincronizados = new Set();

export async function sincronizarRolPorCargo(accessToken) {
  if (!accessToken) return { ok: false, omitido: 'sin token' };

  // La huella basta: dos tokens distintos del mismo usuario comparten cabecera y
  // sujeto, y lo que importa es no repetir la misma sincronizacion en rafaga.
  const huella = String(accessToken).slice(-32);

  if (yaSincronizados.has(huella)) return { ok: true, omitido: 'ya sincronizado' };

  yaSincronizados.add(huella);

  const res = await fetch('/api/auth/sincronizar-rol/', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  }).catch(() => null);

  if (!res?.ok) return { ok: false, omitido: 'sin sincronizar' };

  return res.json().catch(() => ({ ok: true }));
}

// Actualiza los custom claims de autorización (rol + alcance) del usuario objetivo
// llamando al endpoint server-side protegido. Debe invocarse después de guardar la
// asignación de rol. Si el objetivo es el propio usuario, refresca su token para
// que los nuevos claims tomen efecto de inmediato.
export async function actualizarClaimsAutorizacion({ uidUsuario, correo = '' } = {}) {
  if (!AUTH?.currentUser) {
    return { ok: false, omitido: 'sin sesión activa' };
  }

  const token = await AUTH.currentUser.getIdToken();

  const res = await fetch('/api/admin/set-user-claims/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ uidUsuario, correo }),
  });

  const data = await res.json().catch(() => ({}));

  // Degradación silenciosa: mientras el backend de claims aún no está configurado
  // (sin service account → 503), no es un error real que deba alertar al usuario.
  // La asignación de rol ya se guardó; los claims se sincronizarán cuando el
  // servidor esté listo (o vía el backfill).
  if (res.status === 503) {
    return { ok: false, omitido: 'backend de claims no configurado' };
  }

  if (!res.ok) {
    throw new Error(data?.error || 'No se pudieron actualizar los permisos de acceso.');
  }

  if (data?.uid && AUTH.currentUser && data.uid === AUTH.currentUser.uid) {
    await AUTH.currentUser.getIdToken(true);
  }

  return data;
}

export async function guardarPermisosDirectosUsuario({
  uidUsuario,
  permisos = [],
  permisosExcluidos = [],
  permisosMetadata = {},
  usuario = null,
} = {}) {
  assertFirebase();

  if (!uidUsuario) {
    throw new Error('uidUsuario es requerido para guardar permisos.');
  }

  const payload = withTimestamps({
    permisos: Array.from(new Set(permisos.filter(Boolean).map(String))),
    permisosExcluidos: Array.from(new Set(permisosExcluidos.filter(Boolean).map(String))),
    permisosMetadata,
    permisosActualizadosPor: usuario?.uid || usuario?.email || 'sistema',
    permisosActualizadosEn: new Date().toISOString(),
  });

  await setDoc(doc(FIRESTORE, COLECCIONES_AUTORIZACION.usuariosRoles, String(uidUsuario)), payload, {
    merge: true,
  });

  return payload;
}
