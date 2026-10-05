import { normalizeApiResponse } from 'src/utils/normalize-api-response';
import { UPSTREAM_KEYS, invalidateUpstream } from 'src/utils/upstream-cache';

import { exigirPermisoDeCargoRest } from 'src/server/sesion-rest.mjs';

export async function PUT(req) {
  try {
    // La escritura efectiva ocurre al aprobar una propuesta.
    const noAutorizado = await exigirPermisoDeCargoRest(req, ['organizacion.aprobar_cambios']);

    if (noAutorizado) return noAutorizado;

    const body = await req.json();

    const res = await fetch('https://systexploradores.somee.com/api/Regiones/UpdateRegiones', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
    });

    invalidateUpstream(UPSTREAM_KEYS.regiones);

    const text = await res.text();
    const parsed = text ? JSON.parse(text) : {};

    return Response.json(normalizeApiResponse(parsed), { status: res.status });
  } catch (error) {
    return Response.json({ error: 'Error actualizando regional' }, { status: 500 });
  }
}
