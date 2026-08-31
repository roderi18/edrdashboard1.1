import { normalizeApiResponse } from 'src/utils/normalize-api-response';
import { UPSTREAM_KEYS, invalidateUpstream } from 'src/utils/upstream-cache';

import { exigirSesionRest } from 'src/server/sesion-rest.mjs';

export async function PUT(req) {
  try {
    // Sin sesion no se toca un destacamento. El alcance —cual puede tocar— sigue
    // decidiendose en el navegador.
    const noAutorizado = await exigirSesionRest(req);

    if (noAutorizado) return noAutorizado;

    const body = await req.json();

    const res = await fetch(
      'https://systexploradores.somee.com/api/Destacamentos/UpdateDestacamento',
      {
        method: 'POST', // 👈 tu API usa POST
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(body),
      }
    );

    invalidateUpstream(UPSTREAM_KEYS.destacamentos);

    const text = await res.text();

    const parsed = text ? JSON.parse(text) : {};

    return Response.json(normalizeApiResponse(parsed), { status: res.status });
  } catch (error) {
    return Response.json({ error: 'Error actualizando destacamento' }, { status: 500 });
  }
}
