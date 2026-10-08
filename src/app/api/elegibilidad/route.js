import { leerElegibilidad } from 'src/server/elegibilidad.mjs';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const id = new URL(request.url).searchParams.get('id');
  if (!id || !/^\d{1,12}$/.test(id)) return Response.json({ error: 'Destacamento inválido.' }, { status: 400 });
  try {
    return Response.json(await leerElegibilidad(id), { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('[elegibilidad]', error);
    return Response.json({ error: 'No se pudo validar el destacamento.' }, { status: 502 });
  }
}
