import { UPSTREAM_KEYS, invalidateUpstream } from 'src/utils/upstream-cache';

import { exigirSesionRest } from 'src/server/sesion-rest.mjs';

export async function POST(req) {
  try {
    // Sin sesion no se crea una iglesia.
    const noAutorizado = await exigirSesionRest(req);

    if (noAutorizado) return noAutorizado;

    const body = await req.json();

    // El proxy TRANSPORTA, no decide. Antes volvia a rellenar por su cuenta
    // —incluido un `test@demo2.com` y un `idSeccion: 1`—, asi que aunque el
    // formulario mandara los datos bien, cualquier hueco se tapaba aqui otra
    // vez sin que nadie lo viera. Lo que falte debe fallar arriba, en la
    // validacion, no arreglarse a escondidas en el camino.
    const payload = {
      idIglesia: Number(body.idIglesia) || 0,
      nombre: body.nombre?.trim() ?? '',
      pastor: body.pastor?.trim() ?? '',
      telefono: body.telefono?.trim() ?? '',
      direccion: body.direccion?.trim() ?? '',
      correo: body.correo?.trim() ?? '',
      idSeccion: Number(body.idSeccion) || null,
    };

    const res = await fetch('https://systexploradores.somee.com/api/Iglesias/SetIglesia', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/plain, */*',
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
    });

    invalidateUpstream(UPSTREAM_KEYS.iglesias);

    const raw = await res.text();

    let parsed = null;
    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch {
      parsed = null;
    }

    if (!res.ok) {
      return Response.json(
        {
          error: 'Error al crear iglesia en Somee',
          status: res.status,
          raw: raw || null,
          payload,
        },
        { status: res.status }
      );
    }

    return Response.json(parsed ?? { success: true, raw }, { status: 200 });
  } catch (error) {
    return Response.json(
      {
        error: 'Error creando iglesia',
        detail: error.message,
      },
      { status: 500 }
    );
  }
}
