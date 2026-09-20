import { FieldValue } from 'firebase-admin/firestore';

import { getAdminDb, getAdminAuth, isAdminConfigured } from 'src/server/firebase-admin';

import { ROLES_POR_CODIGO } from 'src/auth/permissions/roles';
import { deriveUserClaims } from 'src/auth/permissions/user-claims';

export const runtime = 'nodejs';

const COLECCION_USUARIOS_ROLES = 'usuarios_roles';

const jsonError = (message, status) => Response.json({ error: message }, { status });

const getBearerToken = (req) => {
  const header = req.headers.get('authorization') || req.headers.get('Authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);

  return match ? match[1].trim() : '';
};

const normalizarRol = (value) =>
  String(value ?? '')
    .trim()
    .toLowerCase();

export async function POST(req) {
  if (!isAdminConfigured()) {
    return jsonError('El servidor no tiene configurado FIREBASE_SERVICE_ACCOUNT.', 503);
  }

  const token = getBearerToken(req);
  if (!token) return jsonError('Falta el token de autorización.', 401);

  const auth = getAdminAuth();
  let caller;

  try {
    caller = await auth.verifyIdToken(token);
  } catch {
    return jsonError('Token inválido o expirado.', 401);
  }

  const authUser = await auth.getUser(caller.uid).catch(() => null);
  if (!authUser || normalizarRol(authUser.email) !== normalizarRol(caller.email)) {
    return jsonError('No se pudo verificar la cuenta autorizada.', 403);
  }

  const db = getAdminDb();
  const asignacionRef = db.collection(COLECCION_USUARIOS_ROLES).doc(caller.uid);
  const asignacionActual = await asignacionRef.get();
  const datosActuales = asignacionActual.exists ? asignacionActual.data() : {};
  const esAdministradorGlobalActivo =
    datosActuales?.activo !== false &&
    normalizarRol(datosActuales?.rolId) === 'administrador_global';
  const tieneAccesoDeRetorno =
    datosActuales?.activo !== false && datosActuales?.selectorRolAdminGlobal === true;

  // La primera vez se exige la asignación activa y exacta de Administrador
  // Global. Se deja una marca en este documento, que solo escribe el servidor,
  // para que el titular pueda volver a cambiar o recuperar su rol luego de que
  // la asignación principal haya pasado a ser el rol elegido.
  if (!esAdministradorGlobalActivo && !tieneAccesoDeRetorno) {
    return jsonError('La cuenta no tiene una asignación activa de Administrador Global.', 403);
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return jsonError('Cuerpo inválido.', 400);
  }

  const rolId = normalizarRol(body?.rolId);
  const rol = ROLES_POR_CODIGO[rolId];

  if (!rol?.activo) {
    return jsonError('El rol solicitado no existe o está inactivo.', 422);
  }

  const alcance = {
    tipo: rol.alcancePredeterminado,
    modo: rol.alcancePredeterminado,
  };
  const payload = {
    uidUsuario: caller.uid,
    correo: authUser.email || caller.email,
    nombre: authUser.displayName || datosActuales?.nombre || '',
    rolId,
    rolNombre: rol.nombre,
    alcance,
    restricciones: {},
    cargos: [],
    simulacion: FieldValue.delete(),
    activo: true,
    selectorRolAdminGlobal: true,
    asignadoPor: caller.uid,
    asignadoEn: new Date().toISOString(),
    actualizadoEnServidor: FieldValue.serverTimestamp(),
  };

  // El Admin SDK evita deliberadamente las escrituras del navegador que las
  // reglas de Firestore mantienen cerradas para todos los usuarios.
  await asignacionRef.set(payload, { merge: true });

  const claimsDeRol = deriveUserClaims({
    rolId,
    alcance,
    idMiembros: datosActuales?.idMiembros ?? datosActuales?.memberId,
  });
  const claims = { ...(authUser.customClaims || {}), ...claimsDeRol };
  await auth.setCustomUserClaims(caller.uid, claims);

  return Response.json({ ok: true, rolId, rolNombre: rol.nombre });
}
