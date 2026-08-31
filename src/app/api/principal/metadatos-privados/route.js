import 'server-only';

import { createHash, timingSafeEqual } from 'crypto';

import { origenDe, limiteSuperado } from 'src/server/limite-intentos';
import { getAdminDb, getAdminAuth, isAdminConfigured } from 'src/server/firebase-admin';

export const runtime = 'nodejs';

const COLECCION_PRIVADA = 'metadatos_privados_publicaciones';
const CLAVE_HASH = '4fc3180dff286d518aa23737f7f37bc6ab1cbc213bc5710d82ff72d8faa5ed43';

const tokenDe = (req) => {
  const header = req.headers.get('authorization') || req.headers.get('Authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);

  return match ? match[1].trim() : '';
};

const normalizarRol = (value) => String(value ?? '').trim().toLowerCase();

const identificar = async (req) => {
  const token = tokenDe(req);

  if (!token) return null;

  return getAdminAuth().verifyIdToken(token).catch(() => null);
};

const rolDe = async (usuario) => {
  const db = getAdminDb();
  const [acceso, admin] = await Promise.all([
    db.collection('usuarios_roles').doc(String(usuario.uid)).get().catch(() => null),
    db.collection('admins').doc(String(usuario.uid)).get().catch(() => null),
  ]);
  const datos = acceso?.exists ? acceso.data() : admin?.exists ? admin.data() : {};
  const rolDirecto = normalizarRol(datos?.rolId ?? datos?.roleId ?? datos?.rol ?? datos?.role);

  if (rolDirecto) return rolDirecto;

  // Algunas cuentas administrativas antiguas usan `admin001` como id del
  // documento y guardan el uid real dentro del perfil.
  const [accesoPorUid, adminPorUid] = await Promise.all([
    db.collection('usuarios_roles').where('uid', '==', usuario.uid).limit(1).get(),
    db.collection('admins').where('uid', '==', usuario.uid).limit(1).get(),
  ]);
  const perfil = accesoPorUid.docs[0]?.data() || adminPorUid.docs[0]?.data() || {};

  return normalizarRol(
    perfil.rolId ?? perfil.roleId ?? perfil.rol ?? perfil.role ?? usuario?.rol
  );
};

const claveCorrecta = (clave) => {
  const recibido = createHash('sha256').update(String(clave ?? '')).digest();
  const esperado = Buffer.from(CLAVE_HASH, 'hex');

  return recibido.length === esperado.length && timingSafeEqual(recibido, esperado);
};

export async function POST(req) {
  try {
    if (!isAdminConfigured()) {
      return Response.json({ error: 'El servidor no puede proteger esta información.' }, { status: 503 });
    }

    const usuario = await identificar(req);

    if (!usuario) {
      return Response.json({ error: 'Inicia sesión para continuar.' }, { status: 401 });
    }

    const { accion, idPublicacion, clave } = await req.json();
    const id = String(idPublicacion ?? '').trim();

    if (!id) return Response.json({ error: 'Falta identificar la publicación.' }, { status: 400 });

    const db = getAdminDb();

    if (accion === 'registrar_ip') {
      const publicacion = await db.collection('publicaciones').doc(id).get();
      const datos = publicacion.exists ? publicacion.data() : null;

      if (!datos || datos.uidAutor !== usuario.uid || !datos.archivosMultimedia?.length) {
        return Response.json({ error: 'No puedes registrar datos de esa publicación.' }, { status: 403 });
      }

      await db.collection(COLECCION_PRIVADA).doc(id).set(
        {
          idPublicacion: id,
          ipCarga: origenDe(req),
          uidAutor: usuario.uid,
          registradoEn: new Date().toISOString(),
        },
        { merge: true }
      );

      return Response.json({ registrado: true });
    }

    if (accion !== 'revelar_ip') {
      return Response.json({ error: 'Acción no válida.' }, { status: 400 });
    }

    if ((await rolDe(usuario)) !== 'administrador_global') {
      return Response.json(
        { error: 'Solo el Administrador Global puede ver esta información.' },
        { status: 403 }
      );
    }

    const frenado =
      limiteSuperado(req, {
        grupo: 'revelar-ip-publicacion-origen',
        identificador: id,
        maximo: 6,
        ventanaMs: 5 * 60 * 1000,
      }) ??
      limiteSuperado(req, {
        grupo: 'revelar-ip-publicacion-objetivo',
        identificador: id,
        maximo: 20,
        ventanaMs: 5 * 60 * 1000,
        porOrigen: false,
      });

    if (frenado) return frenado;

    if (!claveCorrecta(clave)) {
      return Response.json({ error: 'La contraseña no es correcta.' }, { status: 403 });
    }

    const metadatos = await db.collection(COLECCION_PRIVADA).doc(id).get();
    const ip = metadatos.exists ? String(metadatos.data()?.ipCarga || '') : '';

    if (!ip) {
      return Response.json(
        { error: 'Esta publicación no tiene una IP registrada.' },
        { status: 404 }
      );
    }

    return Response.json({ ip });
  } catch (error) {
    console.error('[metadatos-privados-publicacion] fallo la operación', error);

    return Response.json({ error: 'No se pudo completar la operación.' }, { status: 500 });
  }
}
