import { getAdminDb, getAdminAuth, isAdminConfigured } from 'src/server/firebase-admin';
import { ROLES_ASIGNADOS_A_MANO, resolverRolesPorAsignaciones } from 'src/catalogs/directiva-roles';

import { ROLES } from 'src/auth/permissions/roles';
import { deriveUserClaims } from 'src/auth/permissions/user-claims';
import { PERMISOS_POR_ROL } from 'src/auth/permissions/role-permissions';

export const runtime = 'nodejs';

// ----------------------------------------------------------------------
// EL SERVIDOR SE ENTERA DEL CARGO.
//
// La sesion calcula el rol de cada persona a partir de sus casillas en la
// directiva, pero eso vivia SOLO en el navegador: en Firestore la mayoria de las
// cuentas no tenian `rolId`, y las reglas de Storage —que preguntan por el
// documento `usuarios_roles/<uid>`— no encontraban ni el documento. De ahi que
// un Lider de Grupo viera el boton de subir la foto de un miembro de su
// destacamento y el servidor se la rechazara.
//
// Esta ruta escribe lo que la aplicacion ya sabe, en el sitio donde las reglas
// lo buscan. NO concede nada nuevo: el rol sale de las asignaciones reales de la
// persona, y solo puede sincronizarse a SI MISMA.
//
// Los roles que se asignan a mano —Administrador Global, Funcional y de Tienda—
// no se tocan: los pone una persona y no salen de ninguna casilla.
// ----------------------------------------------------------------------

const COLECCION_USUARIOS_ROLES = 'usuarios_roles';
const COLECCION_ASIGNACIONES = 'asignacionesDirectiva';

const jsonError = (message, status) => Response.json({ error: message }, { status });

const getBearerToken = (req) => {
  const header = req.headers.get('authorization') || req.headers.get('Authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);

  return match ? match[1].trim() : '';
};

const normalizarRol = (valor) => String(valor ?? '').trim().toLowerCase();

/**
 * El id de miembro de quien llama.
 *
 * Las cuentas de miembro guardan su documento bajo el id de miembro y no bajo el
 * uid de Firebase, asi que hay que buscarlo por el campo `uid` cuando el token
 * todavia no trae el claim.
 */
const resolverIdMiembros = async (db, caller) => {
  const delToken = caller?.idMiembros ?? caller?.idMiembro;

  if (delToken) return String(delToken);

  const porUid = await db
    .collection(COLECCION_USUARIOS_ROLES)
    .where('uid', '==', caller.uid)
    .limit(1)
    .get()
    .catch(() => null);

  const documento = porUid?.docs?.[0];

  return documento ? String(documento.data()?.idMiembros ?? documento.id) : '';
};

// El alcance sale de las propias casillas: cada cargo manda sobre SU entidad.
const alcanceDeSusCargos = (cargos = []) => {
  const destino = { destacamento: 'destacamentos', seccional: 'secciones', regional: 'regiones' };
  const alcance = { destacamentos: [], secciones: [], regiones: [] };

  cargos.forEach((cargo) => {
    const clave = destino[cargo?.nivel];

    if (clave && cargo?.idEntidad) alcance[clave].push(String(cargo.idEntidad));
  });

  return {
    destacamentos: [...new Set(alcance.destacamentos)],
    secciones: [...new Set(alcance.secciones)],
    regiones: [...new Set(alcance.regiones)],
  };
};

export async function POST(req) {
  if (!isAdminConfigured()) {
    return jsonError('El servidor no tiene configurado FIREBASE_SERVICE_ACCOUNT.', 503);
  }

  const auth = getAdminAuth();
  const db = getAdminDb();
  const token = getBearerToken(req);

  if (!token) return jsonError('Falta el token de autorización.', 401);

  let caller;

  try {
    caller = await auth.verifyIdToken(token);
  } catch {
    return jsonError('Token inválido o expirado.', 401);
  }

  // Solo se sincroniza a si misma: no hay parametro para apuntar a otra persona.
  const referencia = db.collection(COLECCION_USUARIOS_ROLES).doc(caller.uid);
  const actual = await referencia.get();
  const rolActual = normalizarRol(actual.exists ? actual.data()?.rolId : '');

  // Un rol puesto a mano manda sobre cualquier cargo: se respeta y no se toca.
  if (ROLES_ASIGNADOS_A_MANO.includes(rolActual)) {
    return Response.json({ ok: true, omitido: 'rol asignado a mano', rolId: rolActual });
  }

  const idMiembros = await resolverIdMiembros(db, caller);

  if (!idMiembros) {
    return Response.json({ ok: true, omitido: 'sin id de miembro' });
  }

  const asignaciones = await db
    .collection(COLECCION_ASIGNACIONES)
    .where('idMiembro', '==', String(idMiembros))
    .where('activo', '==', true)
    .get()
    .catch(() => null);

  const cargos = resolverRolesPorAsignaciones(
    (asignaciones?.docs ?? []).map((documento) => documento.data())
  );
  const rolId = cargos[0]?.rol ?? ROLES.USUARIO_COMUN;
  // Los permisos de TODOS sus cargos, no solo los del principal. Las reglas
  // preguntan por un unico `rolId`, asi que quien entra como Coordinador de
  // Adiestramiento de su region —y ademas coordina su destacamento— se quedaba
  // sin lo que le da el cargo local: no podia ni subir la foto de un miembro
  // suyo. Con la lista de permisos en el documento, las reglas lo resuelven por
  // `tienePermisoDirecto` sin depender de cual sea el principal.
  const permisos = [
    ...new Set(cargos.flatMap((cargo) => PERMISOS_POR_ROL[cargo.rol] ?? [])),
  ].sort();
  const alcance = alcanceDeSusCargos(cargos);

  await referencia.set(
    {
      uid: caller.uid,
      uidUsuario: caller.uid,
      idMiembros: String(idMiembros),
      rolId,
      cargos,
      permisos,
      alcance,
      // Deja constancia de que lo puso el sistema a partir de la directiva, para
      // distinguirlo de una asignacion hecha por una persona.
      asignadoPor: 'sistema:cargo',
      sincronizadoEn: new Date().toISOString(),
      activo: true,
    },
    { merge: true }
  );

  // Los claims viajan en el token y los leen las reglas de Firestore; sin
  // refrescarlos, el servidor seguiria viendo el rol anterior hasta el proximo
  // inicio de sesion.
  try {
    await auth.setCustomUserClaims(
      caller.uid,
      deriveUserClaims({ rolId, alcance, idMiembros: String(idMiembros) })
    );
  } catch (error) {
    console.warn('[sincronizar-rol] no se pudieron actualizar los claims', error);
  }

  return Response.json({ ok: true, rolId, cargos: cargos.length });
}
