import { leerSecciones } from 'src/server/datos.mjs';

export const dynamic = 'force-dynamic';

const REGIONES = ['Región Norte', 'Región Central', 'Región Sur', 'Región Este'];

async function imagenEmbebida(url) {
  if (!url) return null;
  const origen = new URL(url);
  if (origen.protocol !== 'https:' || origen.hostname !== 'firebasestorage.googleapis.com' || !origen.pathname.startsWith('/v0/b/')) return null;

  const res = await fetch(origen, { signal: AbortSignal.timeout(15000) });
  const tipo = res.headers.get('content-type') || '';
  if (!res.ok || !tipo.startsWith('image/')) return null;
  const bytes = await res.arrayBuffer();
  if (bytes.byteLength > 500_000) return null;
  return `data:${tipo};base64,${Buffer.from(bytes).toString('base64')}`;
}

// Las fotos regionales vienen del mismo catálogo que usa el mapa de la portada.
// Se embeben para que también aparezcan al convertir la lámina a PNG o PDF.
export async function GET() {
  try {
    const secciones = await leerSecciones();
    const imagenes = await Promise.all(REGIONES.map(async (region) => {
      const url = secciones.find((s) => s.region === region && s.fotoRegion)?.fotoRegion;
      try {
        return [region, await imagenEmbebida(url)];
      } catch {
        return [region, null];
      }
    }));
    return Response.json(Object.fromEntries(imagenes), {
      headers: { 'Cache-Control': 'public, max-age=300' },
    });
  } catch (error) {
    console.error('[api/emblemas-region]', error);
    return Response.json({ error: 'No se pudieron leer los emblemas regionales.' }, { status: 502 });
  }
}
