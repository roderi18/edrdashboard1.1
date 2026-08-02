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
    activo: true,
    asignadoPor: usuario?.uid || usuario?.email || 'sistema',
    asignadoEn: new Date().toISOString(),
  });

  await setDoc(doc(FIRESTORE, COLECCIONES_AUTORIZACION.usuariosRoles, String(uidUsuario)), payload, {
    merge: true,
  });

  return payload;
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

  const res = await fetch('/api/admin/set-user-claims', {
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
