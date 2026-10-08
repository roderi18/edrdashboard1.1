import { buscarPersonas } from 'src/server/padron.mjs';

export const dynamic = 'force-dynamic';

// "¿Quién hace la corrección?": busca miembros por nombre. Mínimo 3 letras y
// como mucho 10 resultados, solo id y nombre (nunca teléfono ni código).
export async function GET(request) {
  try {
    const q = (new URL(request.url).searchParams.get('q') || '').slice(0, 60);
    return Response.json(await buscarPersonas(q), {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    console.error('[personas]', error);
    return Response.json({ error: 'No se pudo buscar.' }, { status: 502 });
  }
}
