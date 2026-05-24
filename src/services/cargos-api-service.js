const getRowsFromApi = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.Data)) return payload.Data;
  if (Array.isArray(payload?.items)) return payload.items;

  return [];
};

const normalizeText = (value = '') =>
  String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const toPositiveNumberOrNull = (value) => {
  const numberValue = Number(value);

  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : null;
};

const normalizeCargo = (cargo = {}) => ({
  ...cargo,
  idCargo: toPositiveNumberOrNull(cargo.idCargo ?? cargo.id),
  nombre: String(cargo.nombre ?? cargo.nombreCargo ?? '').trim(),
});

const parseJsonResponse = async (res) => {
  const text = await res.text();

  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { raw: text };
  }
};

const ensureOk = async (res, fallbackMessage) => {
  const payload = await parseJsonResponse(res);

  if (!res.ok || payload?.Success === false || payload?.success === false) {
    throw new Error(payload?.Message || payload?.message || payload?.error || fallbackMessage);
  }

  return payload;
};

export async function obtenerCargosApi() {
  const res = await fetch('/api/cargos/', { cache: 'no-store' });
  const payload = await ensureOk(res, 'Error al obtener cargos del API');

  return getRowsFromApi(payload)
    .map(normalizeCargo)
    .filter((cargo) => cargo.idCargo);
}

export async function guardarCargoApi({ idCargo, nombre }) {
  const res = await fetch('/api/cargos/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idCargo, nombre }),
  });

  return ensureOk(res, 'Error guardando cargo en API');
}

export async function actualizarCargoApi({ idCargo, nombre }) {
  const res = await fetch('/api/cargos/', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idCargo, nombre }),
  });

  return ensureOk(res, 'Error actualizando cargo en API');
}

export async function asegurarCargoApi({ idCargo, nombre }) {
  const normalizedName = String(nombre || '').trim();

  if (!normalizedName) {
    return null;
  }

  const cargos = await obtenerCargosApi();
  const existingCargo = cargos.find(
    (cargo) =>
      (idCargo && Number(cargo.idCargo) === Number(idCargo)) ||
      normalizeText(cargo.nombre) === normalizeText(normalizedName)
  );

  if (existingCargo?.idCargo) {
    return existingCargo;
  }

  await guardarCargoApi({
    idCargo: toPositiveNumberOrNull(idCargo) || 0,
    nombre: normalizedName,
  });

  const updatedCargos = await obtenerCargosApi();

  return (
    updatedCargos.find((cargo) => normalizeText(cargo.nombre) === normalizeText(normalizedName)) ||
    null
  );
}

export async function obtenerCargosMiembroApi(idMiembro) {
  const query = idMiembro ? `?idMiembro=${encodeURIComponent(idMiembro)}` : '';
  const res = await fetch(`/api/cargos-miembros/${query}`, { cache: 'no-store' });
  const payload = await ensureOk(res, 'Error al obtener cargos del miembro');

  return getRowsFromApi(payload);
}

export async function guardarCargoMiembroApi({ idCargo, idMiembro, fechaInicio, fechaFin = null }) {
  const res = await fetch('/api/cargos-miembros/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idCargo, idMiembro, fechaInicio, fechaFin }),
  });

  return ensureOk(res, 'Error guardando cargo del miembro en API');
}

export async function eliminarCargoMiembroApi({
  idCargo,
  idMiembro,
  fechaInicio,
  fechaFin = null,
}) {
  const res = await fetch('/api/cargos-miembros/', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idCargo, idMiembro, fechaInicio, fechaFin }),
  });

  return ensureOk(res, 'Error eliminando cargo del miembro en API');
}
