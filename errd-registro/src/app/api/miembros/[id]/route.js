import { leerFichaMiembro } from 'src/server/datos.mjs';

export const dynamic = 'force-dynamic';

// Precarga de "Tus datos de miembro": solo lo no sensible (ver leerFichaMiembro).
export async function GET(_req, { params }) {
  try {
    const { id } = await params;
    const ficha = await leerFichaMiembro(String(id).slice(0, 12));
    if (!ficha) return Response.json({ error: 'No encontrado.' }, { status: 404 });
    return Response.json(ficha);
  } catch (error) {
    console.error('[api/miembros/id]', error);
    return Response.json({ error: 'No se pudo leer.' }, { status: 502 });
  }
}
