import { normalizeApiResponse } from 'src/utils/normalize-api-response';
import { UPSTREAM_KEYS, invalidateUpstream } from 'src/utils/upstream-cache';

import { exigirSesionRest } from 'src/server/sesion-rest.mjs';

export async function POST(req) {
  try {
    // Sin sesion no se crea una region.
    const noAutorizado = await exigirSesionRest(req);

    if (noAutorizado) return noAutorizado;

    const body = await req.json();

    const res = await fetch('https://systexploradores.somee.com/api/Regiones/SetRegiones', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
    });

    invalidateUpstream(UPSTREAM_KEYS.regiones);

    const data = await res.json();

    return Response.json(normalizeApiResponse(data));
  } catch (error) {
    return Response.json({ error: 'Error creando regional' }, { status: 500 });
  }
}
