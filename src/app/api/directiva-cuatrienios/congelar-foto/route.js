import { exigirSesionRest } from 'src/server/sesion-rest.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ----------------------------------------------------------------------
// Copia una foto de perfil a la carpeta de la Directiva por cuatrienio.
//
// La historia no puede enlazar la foto de perfil: al cambiarla, Storage
// reemplaza el archivo y el enlace viejo deja de servir, asi que la Directiva
// 2022-2026 se quedaba con la cara nueva o sin ninguna. Hace falta una COPIA.
//
// La hace el servidor porque el navegador no puede leer un archivo de Storage
// (CORS). Pero escribe con el token de quien lo pide, por la API REST de
// Storage: son las reglas de `storage.rules` —Administrador Global u Oficina
// Nacional— las que deciden, igual que si subiera el archivo a mano. Sin
// `firebase-admin`, que en Netlify tumba la ruta entera.
// ----------------------------------------------------------------------

// El mismo tope que `esImagenPermitida` de storage.rules.
const TOPE_BYTES = 5 * 1024 * 1024;
const RUTA_VALIDA = /^directiva-historica\/\d{4}-\d{4}\/[a-zA-Z0-9_-]{1,200}\.webp$/;
const EXTENSION_POR_TIPO = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'image/png': 'png',
};

const bucket = () => String(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '').trim();

const leerToken = (req) =>
  String(req.headers.get('authorization') || '')
    .replace(/^Bearer\s+/i, '')
    .trim();

// Solo archivos de NUESTRO bucket: sin esto la ruta serviria para que el
// servidor descargara cualquier direccion que le pasaran.
const esDeNuestroStorage = (url) => {
  try {
    const direccion = new URL(url);

    return (
      direccion.protocol === 'https:' &&
      direccion.hostname === 'firebasestorage.googleapis.com' &&
      direccion.pathname.startsWith(`/v0/b/${bucket()}/o/`)
    );
  } catch {
    return false;
  }
};

export async function POST(req) {
  const noAutorizado = await exigirSesionRest(req);

  if (noAutorizado) return noAutorizado;

  const { urlOrigen = '', ruta = '' } = await req.json().catch(() => ({}));

  if (!bucket()) {
    return Response.json({ error: 'Storage no está configurado en el servidor.' }, { status: 503 });
  }

  if (!RUTA_VALIDA.test(String(ruta)) || !esDeNuestroStorage(urlOrigen)) {
    return Response.json({ error: 'La foto o el destino no son válidos.' }, { status: 400 });
  }

  const origen = await fetch(urlOrigen, { cache: 'no-store' }).catch(() => null);

  if (!origen?.ok) {
    return Response.json({ error: 'No se encontró la foto de perfil.' }, { status: 404 });
  }

  const tipo = String(origen.headers.get('content-type') || '')
    .split(';')[0]
    .trim()
    .toLowerCase();
  const extension = EXTENSION_POR_TIPO[tipo];

  if (!extension) {
    return Response.json({ error: 'La foto de perfil no es una imagen.' }, { status: 415 });
  }

  const bytes = Buffer.from(await origen.arrayBuffer());

  if (bytes.length > TOPE_BYTES) {
    return Response.json({ error: 'La foto de perfil es demasiado grande.' }, { status: 413 });
  }

  // La extension sigue al tipo real: una foto antigua en JPG no se guarda como
  // si fuera WebP.
  const destino = ruta.replace(/\.webp$/, `.${extension}`);
  const subida = await fetch(
    `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket())}/o?uploadType=media&name=${encodeURIComponent(destino)}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Firebase ${leerToken(req)}`,
        'Content-Type': tipo,
      },
      body: bytes,
      cache: 'no-store',
    }
  ).catch(() => null);

  if (!subida?.ok) {
    const estado = subida?.status === 403 ? 403 : 502;

    return Response.json(
      {
        error:
          estado === 403
            ? 'Tu cargo no puede guardar fotos de la Directiva por cuatrienio.'
            : 'No se pudo guardar la copia de la foto.',
      },
      { status: estado }
    );
  }

  const metadatos = await subida.json().catch(() => ({}));
  const tokenDescarga = String(metadatos?.downloadTokens || '').split(',')[0];

  return Response.json({
    fotoRuta: destino,
    fotoUrl: `https://firebasestorage.googleapis.com/v0/b/${bucket()}/o/${encodeURIComponent(destino)}?alt=media${tokenDescarga ? `&token=${tokenDescarga}` : ''}`,
  });
}
