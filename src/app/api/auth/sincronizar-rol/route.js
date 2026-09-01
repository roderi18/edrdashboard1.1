import { ROLES_QUE_NO_SALEN_DE_UNA_CASILLA } from 'src/catalogs/directiva-roles';
import { getAdminDb, getAdminAuth, isAdminConfigured } from 'src/server/firebase-admin';
import {
  leerAsignacionesDe,
  resolverAccesoPorCargo,
  escribirAccesoPorCargo,
  COLECCION_USUARIOS_ROLES,
} from 'src/server/rol-por-cargo';

import { puedeUsarSelectorDeRol } from 'src/auth/permissions/admin-role-switch-policy';

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

  // La cuenta global autorizada elige aquí un rol manual para probar la
  // aplicación. No debe recalcularse desde sus posibles casillas de directiva,
  // porque eso desharía la selección justo después de recargar la página.
  if (puedeUsarSelectorDeRol(caller.email)) {
    return Response.json({ ok: true, omitido: 'rol manual del Administrador Global' });
  }

  // Solo se sincroniza a si misma: no hay parametro para apuntar a otra persona.
  const referencia = db.collection(COLECCION_USUARIOS_ROLES).doc(caller.uid);
  const actual = await referencia.get();
  const rolActual = normalizarRol(actual.exists ? actual.data()?.rolId : '');

  // Un rol puesto a mano manda sobre cualquier cargo: se conserva. Pero antes se
  // salia de aqui sin escribir NADA, y entonces sus cargos —los permisos y el
  // alcance de su casilla en el destacamento— nunca llegaban al documento que
  // miran las reglas. Ahora se escribe igual, con su rol intacto.
  const rolFijo = ROLES_QUE_NO_SALEN_DE_UNA_CASILLA.includes(rolActual) ? rolActual : '';

  const idMiembros = await resolverIdMiembros(db, caller);

  if (!idMiembros) {
    return Response.json({ ok: true, omitido: 'sin id de miembro', rolId: rolActual });
  }

  const acceso = resolverAccesoPorCargo(await leerAsignacionesDe(db, idMiembros), { rolFijo });
  await escribirAccesoPorCargo({ db, auth, uid: caller.uid, idMiembros, acceso });

  return Response.json({ ok: true, rolId: acceso.rolId, cargos: acceso.cargos.length });
}
