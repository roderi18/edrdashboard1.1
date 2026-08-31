import { normalizeApiResponse } from 'src/utils/normalize-api-response';
import { UPSTREAM_KEYS, invalidateUpstream } from 'src/utils/upstream-cache';

import { exigirSesionRest } from 'src/server/sesion-rest.mjs';

export async function PUT(req) {
  try {
    // Sin sesion no se toca una iglesia.
    const noAutorizado = await exigirSesionRest(req);

    if (noAutorizado) return noAutorizado;

    const body = await req.json();

    const res = await fetch('https://systexploradores.somee.com/api/Iglesias/UpdateIglesia', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      // El cuerpo es el `IglesiasDTO` DIRECTO, sin envoltorio. Iba
      // dentro de un `obj` que ni el swagger del backend declara ni usa
      // ningun otro proxy: Secciones, Regiones y la propia creacion de
      // iglesias mandan el DTO plano, y esos si responden 200.
      body: JSON.stringify({
        idIglesia: body.id,
        nombre: body.name || body.churchName,
        pastor: body.pastor || '',
        direccion: body.address || '',
        correo: body.correo || '',
        // El telefono viaja siempre: al omitirlo, el update lo dejaba
        // en blanco en cada guardado.
        telefono: body.telefono || '',
        idSeccion: body.sectionId || body.idSeccion || null,
      }),
    });

    invalidateUpstream(UPSTREAM_KEYS.iglesias);

    const text = await res.text();

    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      return Response.json(
        { error: 'Respuesta no es JSON', raw: text },
        { status: res.ok ? 500 : res.status }
      );
    }

    if (!res.ok || data?.success === false) {
      return Response.json(normalizeApiResponse(data), { status: res.status || 500 });
    }

    return Response.json(normalizeApiResponse(data), { status: 200 });
  } catch {
    return Response.json({ error: 'Error actualizando iglesia' }, { status: 500 });
  }
}
