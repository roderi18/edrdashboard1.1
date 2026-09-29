import { buscarMiembros } from 'src/server/datos.mjs';

export const dynamic = 'force-dynamic';

// Busca personas mayores de edad (o sin fecha de nacimiento) por nombre.
// Mínimo 3 letras y como mucho 10 resultados: solo id y nombre, nunca código,
// teléfono ni fecha de nacimiento.
export async function GET(req) {
  try {
    const q = new URL(req.url).searchParams.get('q') || '';
    return Response.json(await buscarMiembros(q.slice(0, 60)));
  } catch (error) {
    console.error('[api/miembros]', error);
    return Response.json({ error: 'No se pudo buscar.' }, { status: 502 });
  }
}
