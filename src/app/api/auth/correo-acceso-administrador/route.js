import 'server-only';

import { limiteSuperado } from 'src/server/limite-intentos';
import { getAdminDb, getAdminAuth, isAdminConfigured } from 'src/server/firebase-admin';

export const runtime = 'nodejs';

// ----------------------------------------------------------------------
// Convierte el nombre de usuario administrativo en el correo de Firebase.
//
// Esta operación necesariamente ocurre antes de iniciar sesión. Por eso se
// ejecuta con el Admin SDK en el servidor y entrega únicamente el correo que la
// pantalla necesita; nunca abre `admins` ni `users` al navegador.
// ----------------------------------------------------------------------

const normalizar = (valor) => String(valor ?? '').trim().toLowerCase().replace(/\s+/g, '');

const variantesDe = (valor) =>
  [...new Set([String(valor ?? '').trim(), normalizar(valor), normalizar(valor).toUpperCase()])].filter(
    Boolean
  );

const buscarDocumentos = async (coleccion, usuario) => {
  const db = getAdminDb();
  const variantes = variantesDe(usuario);
  const campos = ['codigoUsuario', 'codigoMiembro', 'username', 'uid'];
  const consultas = [
    ...variantes.map((id) => db.collection(coleccion).doc(id).get()),
    ...campos.flatMap((campo) =>
      variantes.map((valor) => db.collection(coleccion).where(campo, '==', valor).limit(1).get())
    ),
  ];
  const resultados = await Promise.allSettled(consultas);
  const documentos = [];
  const vistos = new Set();

  resultados.forEach((resultado) => {
    if (resultado.status !== 'fulfilled') return;

    const candidatos = Array.isArray(resultado.value?.docs)
      ? resultado.value.docs
      : [resultado.value];

    candidatos.filter((documento) => documento?.exists).forEach((documento) => {
      if (vistos.has(documento.ref.path)) return;

      vistos.add(documento.ref.path);
      documentos.push(documento);
    });
  });

  return documentos;
};

const correoAutorizadoDe = async (documento) => {
  const datos = documento?.data?.() ?? {};
  const auth = getAdminAuth();
  const posiblesUid = [...new Set([datos.uid, datos.idUsuario, documento?.id].filter(Boolean))];

  for (const uid of posiblesUid) {
    try {
      const cuenta = await auth.getUser(String(uid));

      if (cuenta.email) return cuenta.email;
    } catch {
      // Algunos registros antiguos usan el código como id del documento, no el
      // uid de Firebase. En ese caso se continúa con el correo del perfil.
    }
  }

  return datos.correo || datos.email || '';
};

export async function POST(req) {
  try {
    if (!isAdminConfigured()) return Response.json({ correo: '' });

    const frenado = limiteSuperado(req, {
      grupo: 'correo-acceso-administrador',
      maximo: 15,
      ventanaMs: 60 * 1000,
    });

    if (frenado) return frenado;

    const { usuario } = await req.json();
    const usuarioNormalizado = normalizar(usuario);

    if (
      !usuarioNormalizado ||
      usuarioNormalizado.length > 120 ||
      usuarioNormalizado.includes('@') ||
      !usuarioNormalizado.startsWith('admin')
    ) {
      return Response.json({ correo: '' });
    }

    const perfilesAdmin = await buscarDocumentos('admins', usuarioNormalizado);

    for (const perfil of perfilesAdmin) {
      const correo = await correoAutorizadoDe(perfil);

      if (correo) return Response.json({ correo: String(correo).trim().toLowerCase() });
    }

    // Compatibilidad con administradores antiguos que quedaron solamente en
    // `users`, que era la segunda fuente utilizada por el acceso anterior.
    const perfilesUsuario = await buscarDocumentos('users', usuarioNormalizado);

    for (const perfil of perfilesUsuario) {
      const datos = perfil.data() ?? {};
      const rol = String(datos.rol ?? datos.role ?? '').trim().toLowerCase();

      if (!['admin', 'administrador'].includes(rol)) continue;

      const correo = await correoAutorizadoDe(perfil);

      if (correo) return Response.json({ correo: String(correo).trim().toLowerCase() });
    }

    // No se diferencia entre "no existe" y "no es administrador" para no
    // convertir esta ruta pública en un listado de cuentas.
    return Response.json({ correo: '' });
  } catch (error) {
    console.error('[correo-acceso-administrador] no se pudo resolver', error);

    return Response.json({ correo: '' });
  }
}
