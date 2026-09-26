import { leerSecciones } from 'src/server/datos.mjs';

export const dynamic = 'force-dynamic';

// Secciones con su región, para registrar un destacamento que no existe.
export async function GET() {
  try {
    return Response.json(await leerSecciones());
  } catch (error) {
    console.error('[api/secciones]', error);
    return Response.json({ error: 'No se pudieron leer las secciones.' }, { status: 502 });
  }
}
