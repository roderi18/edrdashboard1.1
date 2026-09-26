import { leerDestacamentos } from 'src/server/datos.mjs';

export const dynamic = 'force-dynamic';

// Todos los destacamentos con lo que ya está registrado (sin teléfonos).
export async function GET() {
  try {
    return Response.json(await leerDestacamentos());
  } catch (error) {
    console.error('[api/destacamentos]', error);
    return Response.json({ error: 'No se pudieron leer los destacamentos.' }, { status: 502 });
  }
}
