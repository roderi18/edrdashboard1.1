import { getAdminDb, getAdminAuth, isAdminConfigured } from 'src/server/firebase-admin';

import { PERMISOS } from 'src/auth/permissions/permissions';
import { PERMISOS_POR_ROL } from 'src/auth/permissions/role-permissions';
import { isKnownRole, deriveUserClaims } from 'src/auth/permissions/user-claims';

export const runtime = 'nodejs';

const COLECCION_USUARIOS_ROLES = 'usuarios_roles';

const jsonError = (message, status) => Response.json({ error: message }, { status });

const getBearerToken = (req) => {
  const header = req.headers.get('authorization') || req.headers.get('Authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
};

const normalizeRol = (value) => String(value ?? '').trim().toLowerCase();

// ¿El rol puede gestionar roles (y por tanto setear claims)? Global o cualquiera
// con administracion.gestionar_roles en el catálogo (única fuente de verdad).
const puedeGestionarRoles = (rol) => {
  const rolId = normalizeRol(rol);
  if (rolId === 'administrador_global') return true;
  return (PERMISOS_POR_ROL[rolId] || []).includes(PERMISOS.ADMINISTRACION_GESTIONAR_ROLES);
};

const leerAsignacion = async (db, docId) => {
  if (!docId) return null;
  const snap = await db.collection(COLECCION_USUARIOS_ROLES).doc(String(docId)).get();
  return snap.exists ? snap.data() : null;
};

// Resuelve el UID de Firebase Auth del usuario objetivo (los custom claims se
// indexan por ese UID, que puede diferir del id del documento de asignación).
const resolverAuthUid = async (auth, { uidObjetivo, correo }) => {
  if (uidObjetivo) {
    try {
      const user = await auth.getUser(String(uidObjetivo));
      return user.uid;
    } catch {
      /* no era un uid de Auth; intentamos por correo */
    }
  }
  if (correo) {
    try {
      const user = await auth.getUserByEmail(String(correo));
      return user.uid;
    } catch {
      /* sin coincidencia */
    }
  }
  return '';
};

export async function POST(req) {
  if (!isAdminConfigured()) {
    return jsonError('El servidor no tiene configurado FIREBASE_SERVICE_ACCOUNT.', 503);
  }

  const auth = getAdminAuth();
  const db = getAdminDb();

  // 1) Autenticar al llamante.
  const token = getBearerToken(req);
  if (!token) return jsonError('Falta el token de autorización.', 401);

  let caller;
  try {
    caller = await auth.verifyIdToken(token);
  } catch {
    return jsonError('Token inválido o expirado.', 401);
  }

  // 2) Autorizar al llamante: debe poder gestionar roles (por claims o por su
  //    asignación en Firestore, para no bloquear el bootstrap del primer admin).
  const callerAssignment = await leerAsignacion(db, caller.uid);
  const callerRol = caller.rol || callerAssignment?.rolId || '';
  if (!puedeGestionarRoles(callerRol)) {
    return jsonError('No tienes permiso para gestionar roles.', 403);
  }

  // 3) Leer el objetivo.
  let body;
  try {
    body = await req.json();
  } catch {
    return jsonError('Cuerpo inválido.', 400);
  }

  const { uidUsuario, correo } = body || {};
  if (!uidUsuario && !correo) {
    return jsonError('Se requiere uidUsuario o correo del objetivo.', 400);
  }

  const asignacion = await leerAsignacion(db, uidUsuario);
  if (!asignacion?.rolId) {
    return jsonError('El usuario objetivo no tiene una asignación de rol.', 404);
  }
  if (!isKnownRole(asignacion.rolId)) {
    return jsonError(`Rol desconocido: ${asignacion.rolId}.`, 422);
  }

  const authUid = await resolverAuthUid(auth, { uidObjetivo: uidUsuario, correo });
  if (!authUid) {
    return jsonError('No se pudo resolver el usuario de Firebase Auth del objetivo.', 404);
  }

  // 4) Derivar y setear los claims.
  const claims = deriveUserClaims({ rolId: asignacion.rolId, alcance: asignacion.alcance });
  await auth.setCustomUserClaims(authUid, claims);

  return Response.json({ ok: true, uid: authUid, claims });
}
