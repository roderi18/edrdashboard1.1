import { UPSTREAM_KEYS, fetchUpstreamText, invalidateUpstream } from 'src/utils/upstream-cache';

const CARGOS_ENDPOINT = 'https://systexploradores.somee.com/api/Cargos';

const jsonResponse = (payload, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const parseApiResponse = async (res) => {
  const text = await res.text();

  try {
    return {
      text,
      data: text ? JSON.parse(text) : null,
    };
  } catch {
    return {
      text,
      data: null,
    };
  }
};

const proxyCargoRequest = async ({ endpoint, method = 'GET', body }) => {
  const res = await fetch(`${CARGOS_ENDPOINT}/${endpoint}`, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const { text, data } = await parseApiResponse(res);

  if (!res.ok) {
    return jsonResponse(
      {
        Success: false,
        Message: `Error en API de cargos (${res.status})`,
        data,
        raw: text,
      },
      502
    );
  }

  return new Response(text || JSON.stringify(data ?? {}), {
    status: res.status,
    headers: { 'Content-Type': 'application/json' },
  });
};

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (id) {
      return proxyCargoRequest({
        endpoint: `GetCargosById?id=${encodeURIComponent(id)}`,
      });
    }

    // GetAllCargos cacheado (misma respuesta que el proxy directo).
    const upstream = await fetchUpstreamText(
      UPSTREAM_KEYS.cargos,
      `${CARGOS_ENDPOINT}/GetAllCargos`,
      { init: { headers: { Accept: 'application/json' } } }
    );

    if (!upstream.ok) {
      let data = null;

      try {
        data = upstream.text ? JSON.parse(upstream.text) : null;
      } catch {
        data = null;
      }

      return jsonResponse(
        {
          Success: false,
          Message: `Error en API de cargos (${upstream.status})`,
          data,
          raw: upstream.text,
        },
        502
      );
    }

    return new Response(upstream.text || '{}', {
      status: upstream.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return jsonResponse(
      {
        Success: false,
        Message: 'Error al obtener cargos',
        error: error.message,
      },
      500
    );
  }
}

export async function POST(req) {
  try {
    const body = await req.json();

    invalidateUpstream(UPSTREAM_KEYS.cargos);

    return proxyCargoRequest({
      endpoint: 'SetCargos',
      method: 'POST',
      body: {
        idCargo: Number(body.idCargo || 0),
        nombre: body.nombre ?? null,
      },
    });
  } catch (error) {
    return jsonResponse(
      {
        Success: false,
        Message: 'Error creando cargo',
        error: error.message,
      },
      500
    );
  }
}

export async function PUT(req) {
  try {
    const body = await req.json();

    invalidateUpstream(UPSTREAM_KEYS.cargos);

    return proxyCargoRequest({
      endpoint: 'UpdateCargos',
      method: 'POST',
      body: {
        idCargo: Number(body.idCargo || 0),
        nombre: body.nombre ?? null,
      },
    });
  } catch (error) {
    return jsonResponse(
      {
        Success: false,
        Message: 'Error actualizando cargo',
        error: error.message,
      },
      500
    );
  }
}

export async function DELETE(req) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    invalidateUpstream(UPSTREAM_KEYS.cargos);

    return proxyCargoRequest({
      endpoint: `DeleteCargos?id=${encodeURIComponent(id || '')}`,
      method: 'DELETE',
    });
  } catch (error) {
    return jsonResponse(
      {
        Success: false,
        Message: 'Error eliminando cargo',
        error: error.message,
      },
      500
    );
  }
}
