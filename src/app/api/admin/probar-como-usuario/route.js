import 'server-only';

import { createHmac, timingSafeEqual } from 'crypto';

import { getAdminDb, getAdminAuth, isAdminConfigured } from 'src/server/firebase-admin';
import { buscarAccesoMiembro, buscarPerfilesPorNumeroMiembro } from 'src/server/claves-miembro';

import { puedeUsarSelectorDeRol } from 'src/auth/permissions/admin-role-switch-policy';

export const runtime = 'nodejs';

const COOKIE = 'edr_admin_original';
const UN_ANO = 60 * 60 * 24 * 365;

const jsonError = (error, status) => Response.json({ error }, { status });

const bearer = (req) => {
  const match = (req.headers.get('authorization') || '').match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || '';
};

const normalizar = (value) => String(value ?? '').trim().toLowerCase();

const perfilGlobalActivo = (perfil = {}) =>
  normalizar(perfil.rol ?? perfil.role) === 'admin' &&
  normalizar(perfil.estatus ?? perfil.estado ?? 'activo') === 'activo';

const perfilAdmin = async (uid) => {
  const db = getAdminDb();
  const [porUid, porCampo] = await Promise.all([
    db.collection('admins').doc(uid).get(),
    db.collection('admins').where('uid', '==', uid).limit(1).get(),
  ]);

  return porUid.exists ? porUid.data() : porCampo.docs[0]?.data();
};

const verificarAdminGlobal = async (token) => {
  if (!token) return null;

  const auth = getAdminAuth();
  const decodificado = await auth.verifyIdToken(token).catch(() => null);
  if (!decodificado?.uid || !puedeUsarSelectorDeRol(decodificado.email)) return null;

  const cuenta = await auth.getUser(decodificado.uid).catch(() => null);
  if (!cuenta || !puedeUsarSelectorDeRol(cuenta.email)) return null;

  const perfil = await perfilAdmin(decodificado.uid);
  return perfilGlobalActivo(perfil) ? cuenta : null;
};

const secreto = () => process.env.FIREBASE_SERVICE_ACCOUNT || '';
const firma = (payload) => createHmac('sha256', secreto()).update(payload).digest('base64url');

const crearValorCookie = (uid) => {
  const payload = Buffer.from(JSON.stringify({ uid }), 'utf8').toString('base64url');
  return `${payload}.${firma(payload)}`;
};

const leerCookie = (req) => {
  const entrada = (req.headers.get('cookie') || '')
    .split(';')
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${COOKIE}=`));
  const valor = entrada?.slice(COOKIE.length + 1) || '';
  const [payload, recibida] = valor.split('.');

  if (!payload || !recibida || !secreto()) return null;

  const esperada = firma(payload);
  const a = Buffer.from(recibida);
  const b = Buffer.from(esperada);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
};

const atributoCookie = (req, maxAge) => {
  const segura =
    process.env.NODE_ENV === 'production' || req.headers.get('x-forwarded-proto') === 'https';

  return `${COOKIE}=; Path=/api/admin/probar-como-usuario; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${segura ? '; Secure' : ''}`;
};

const buscarCuentaObjetivo = async (codigo) => {
  const perfiles = await buscarPerfilesPorNumeroMiembro(codigo);

  for (const documento of perfiles) {
    const datos = documento.data() || {};
    const idMiembros = datos.idMiembros ?? datos.memberId ?? documento.id;
    const acceso = await buscarAccesoMiembro({
      idMiembros,
      codigoMiembro: datos.codigoMiembro ?? datos.codigoUsuario ?? codigo,
      correo: datos.correo ?? datos.email,
    });

    if (acceso.cuenta && !acceso.cuenta.disabled) {
      return { cuenta: acceso.cuenta, datos: acceso.perfil?.data?.() ?? datos };
    }
  }

  return null;
};

export async function POST(req) {
  if (!isAdminConfigured()) return jsonError('Firebase Admin no está configurado.', 503);

  let body;
  try {
    body = await req.json();
  } catch {
    return jsonError('Solicitud inválida.', 400);
  }

  const accion = body?.accion === 'volver' ? 'volver' : 'entrar';
  const auth = getAdminAuth();

  if (accion === 'volver') {
    const sesion = leerCookie(req);
    if (!sesion?.uid) return jsonError('No se encontró la cuenta administradora original.', 401);

    const cuenta = await auth.getUser(sesion.uid).catch(() => null);
    if (!cuenta || !puedeUsarSelectorDeRol(cuenta.email)) {
      return jsonError('La cuenta administradora original ya no está autorizada.', 403);
    }

    const perfil = await perfilAdmin(cuenta.uid);
    if (!perfilGlobalActivo(perfil)) {
      return jsonError('La cuenta ya no es el Administrador Global activo.', 403);
    }

    const token = await auth.createCustomToken(cuenta.uid);
    const response = Response.json({ token });
    response.headers.append('Set-Cookie', atributoCookie(req, 0));
    return response;
  }

  const administrador = await verificarAdminGlobal(bearer(req));
  if (!administrador) {
    return jsonError('Solo las cuentas Administrador Global autorizadas pueden usar esta función.', 403);
  }

  const codigo = String(body?.codigoMiembro ?? '').trim().toUpperCase();
  if (!/^EDR-\d+$/.test(codigo)) return jsonError('Escribe un código como EDR-10002.', 422);

  const objetivo = await buscarCuentaObjetivo(codigo);
  if (!objetivo) return jsonError('Ese miembro no tiene una cuenta activa para iniciar sesión.', 404);
  if (objetivo.cuenta.uid === administrador.uid) {
    return jsonError('Ya estás usando esa cuenta.', 422);
  }

  const token = await auth.createCustomToken(objetivo.cuenta.uid);
  const nombre =
    objetivo.cuenta.displayName ||
    [objetivo.datos?.nombres, objetivo.datos?.apellidos].filter(Boolean).join(' ') ||
    codigo;
  const response = Response.json({ token, miembro: { codigo, nombre } });
  response.headers.append(
    'Set-Cookie',
    atributoCookie(req, UN_ANO).replace(
      `${COOKIE}=`,
      `${COOKIE}=${crearValorCookie(administrador.uid)}`
    )
  );

  return response;
}

export async function DELETE(req) {
  const response = Response.json({ ok: true });
  response.headers.append('Set-Cookie', atributoCookie(req, 0));
  return response;
}
