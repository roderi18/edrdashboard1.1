import { leerPadron } from 'src/server/padron.mjs';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const lista = (await leerPadron()).map(({ id, numero, nombre, region, seccion }) => ({
      id,
      numero,
      nombre,
      region,
      seccion,
    }));
    return Response.json(lista, {
      headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300' },
    });
  } catch (error) {
    console.error('[catalogo]', error);
    return Response.json({ error: 'No se pudo consultar el padrón.' }, { status: 502 });
  }
}
