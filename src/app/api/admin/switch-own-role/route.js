import { FieldValue } from 'firebase-admin/firestore';

import { getAdminDb, getAdminAuth, isAdminConfigured } from 'src/server/firebase-admin';

import { ROLES_POR_CODIGO } from 'src/auth/permissions/roles';
import { deriveUserClaims } from 'src/auth/permissions/user-claims';
import { puedeUsarSelectorDeRol } from 'src/auth/permissions/admin-role-switch-policy';

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

const esPerfilAdministradorGlobal = (perfil = {}) =>
  normalizarRol(perfil?.rol ?? perfil?.role) === 'admin' &&
  normalizarRol(perfil?.estatus ?? perfil?.estado ?? 'activo') === 'activo' &&
  puedeUsarSelectorDeRol(perfil?.correo ?? perfil?.email);

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

  // Esta es la barrera real. No se confía en el correo enviado por el cliente.
  // El correo procede del token firmado y además se contrasta con Firebase Auth.
  if (!puedeUsarSelectorDeRol(caller.email)) {
    return jsonError('Esta cuenta no está autorizada para cambiar el rol de la sesión.', 403);
  }

  const authUser = await auth.getUser(caller.uid).catch(() => null);
  if (!authUser || !puedeUsarSelectorDeRol(authUser.email)) {
    return jsonError('No se pudo verificar la cuenta autorizada.', 403);
  }

  const db = getAdminDb();
  const [adminPorUid, adminsPorCampo] = await Promise.all([
    db.collection('admins').doc(caller.uid).get(),
    db.collection('admins').where('uid', '==', caller.uid).limit(1).get(),
  ]);
  const perfilAdmin = adminPorUid.exists ? adminPorUid.data() : adminsPorCampo.docs[0]?.data();

  // El correo permitido debe seguir siendo, además, la cuenta global activa del
  // registro de administradores. El rol de simulación puede cambiar; esta
  // identidad administrativa permanente es la que le permite regresar.
  if (!esPerfilAdministradorGlobal(perfilAdmin)) {
    return jsonError('La cuenta autorizada no es el Administrador Global activo.', 403);
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
  const asignacionRef = db.collection(COLECCION_USUARIOS_ROLES).doc(caller.uid);
  const asignacionActual = await asignacionRef.get();
  const datosActuales = asignacionActual.exists ? asignacionActual.data() : {};

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
