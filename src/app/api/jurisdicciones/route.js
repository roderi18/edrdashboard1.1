import { leerJurisdicciones } from 'src/server/padron.mjs';

export const dynamic = 'force-dynamic';

// Regiones y secciones (con su región), para los desplegables de "Corregir datos".
export async function GET() {
  try {
    return Response.json(await leerJurisdicciones(), {
      headers: { 'Cache-Control': 'public, max-age=300' },
    });
  } catch (error) {
    console.error('[jurisdicciones]', error);
    return Response.json({ error: 'No se pudieron leer las regiones.' }, { status: 502 });
  }
}
