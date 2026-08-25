export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ----------------------------------------------------------------------
// RUTA TEMPORAL DE DIAGNOSTICO. Borrar en cuanto se lea.
//
// En Netlify, toda ruta que importa `firebase-admin` devuelve 500 al CARGAR el
// modulo, antes de ejecutar el handler, y desde fuera solo se ve "Internal
// Server Error". Aqui el import se hace en caliente y dentro de un try, asi que
// el fallo se puede contar en vez de tumbar la ruta.
//
// No devuelve datos de nadie: version de Node, si hay variables puestas (solo
// si, no su valor) y el mensaje del error de carga.
// ----------------------------------------------------------------------

const probar = async (etiqueta, cargar) => {
  try {
    await cargar();

    return { modulo: etiqueta, ok: true };
  } catch (error) {
    return {
      modulo: etiqueta,
      ok: false,
      nombre: error?.name ?? '',
      codigo: error?.code ?? '',
      mensaje: String(error?.message ?? '').slice(0, 400),
    };
  }
};

export async function GET() {
  const resultados = await Promise.all([
    probar('firebase-admin/app', () => import('firebase-admin/app')),
    probar('firebase-admin/auth', () => import('firebase-admin/auth')),
    probar('firebase-admin/firestore', () => import('firebase-admin/firestore')),
    probar('src/server/firebase-admin', () => import('src/server/firebase-admin')),
  ]);

  return Response.json({
    nodeVersion: process.version,
    plataforma: `${process.platform}/${process.arch}`,
    // Solo si estan puestas, nunca su contenido.
    tieneServiceAccount: Boolean(process.env.FIREBASE_SERVICE_ACCOUNT),
    tieneApiKeyPublica: Boolean(process.env.NEXT_PUBLIC_FIREBASE_API_KEY),
    resultados,
  });
}
