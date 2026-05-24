const CARGOS_MIEMBROS_ENDPOINT = 'https://systexploradores.somee.com/api/CargosMiembros';

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

const normalizeCargoMiembroPayload = (body = {}) => ({
  idCargo: Number(body.idCargo || 0),
  idMiembro: Number(body.idMiembro || body.idMiembros || 0),
  fechaInicio: body.fechaInicio || new Date().toISOString().slice(0, 10),
  fechaFin: body.fechaFin || null,
});

const proxyCargoMiembroRequest = async ({ endpoint, method = 'GET', body }) => {
  const res = await fetch(`${CARGOS_MIEMBROS_ENDPOINT}/${endpoint}`, {
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
        Message: `Error en API de cargos de miembros (${res.status})`,
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
    const idMiembro = searchParams.get('idMiembro') || searchParams.get('id');

    return proxyCargoMiembroRequest({
      endpoint: idMiembro
        ? `GetAllCargosByIdMiembro?id=${encodeURIComponent(idMiembro)}`
        : 'GetAllCargosMiembros',
    });
  } catch (error) {
    return jsonResponse(
      {
        Success: false,
        Message: 'Error al obtener cargos de miembros',
        error: error.message,
      },
      500
    );
  }
}

export async function POST(req) {
  try {
    const body = await req.json();

    return proxyCargoMiembroRequest({
      endpoint: 'SetCargosMiembro',
      method: 'POST',
      body: normalizeCargoMiembroPayload(body),
    });
  } catch (error) {
    return jsonResponse(
      {
        Success: false,
        Message: 'Error guardando cargo de miembro',
        error: error.message,
      },
      500
    );
  }
}

export async function DELETE(req) {
  try {
    const body = await req.json();

    return proxyCargoMiembroRequest({
      endpoint: 'DeleteCargosMiembro',
      method: 'DELETE',
      body: normalizeCargoMiembroPayload(body),
    });
  } catch (error) {
    return jsonResponse(
      {
        Success: false,
        Message: 'Error eliminando cargo de miembro',
        error: error.message,
      },
      500
    );
  }
}
