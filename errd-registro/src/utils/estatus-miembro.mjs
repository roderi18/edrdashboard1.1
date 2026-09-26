// ----------------------------------------------------------------------
// ESTATUS DEL MIEMBRO: CUATRO VALORES.
//
// Antes solo había "Activo" e "Inactivo" y un miembro que empezaba a faltar no
// se distinguía de uno que llevaba meses sin venir, ni de uno fallecido. Los
// valores que ya estaban guardados no cambian ('active' y 'banned'), para no
// romper lo que ya hay en la API ni en la lista de miembros.
// ----------------------------------------------------------------------

export const ESTATUS_MIEMBRO = Object.freeze({
  ACTIVO: 'active',
  NECESITA_RECLUTAMIENTO: 'reclutamiento',
  INACTIVO: 'banned',
  FALLECIDO: 'fallecido',
});

export const OPCIONES_ESTATUS_MIEMBRO = Object.freeze([
  Object.freeze({
    value: ESTATUS_MIEMBRO.ACTIVO,
    label: 'Activo',
    etiqueta: 'Activo',
    color: 'success',
    descripcion: 'Asiste con regularidad a las reuniones del destacamento.',
  }),
  Object.freeze({
    value: ESTATUS_MIEMBRO.NECESITA_RECLUTAMIENTO,
    label: 'Necesita reclutamiento',
    // En el chip no cabe entero junto a la foto.
    etiqueta: 'Reclutamiento',
    color: 'warning',
    descripcion: 'Ha faltado a 3 reuniones o más. Conviene contactarlo para que vuelva a asistir.',
  }),
  Object.freeze({
    value: ESTATUS_MIEMBRO.INACTIVO,
    label: 'Inactivo',
    etiqueta: 'Inactivo',
    color: 'error',
    descripcion:
      'Lleva más de tres meses ausente. Para volver a estar activo debe ser reclutado y asistir al menos a 3 reuniones seguidas.',
  }),
  Object.freeze({
    value: ESTATUS_MIEMBRO.FALLECIDO,
    label: 'Fallecido',
    etiqueta: 'Fallecido',
    color: 'default',
    descripcion: 'El miembro ha fallecido. Se conserva su registro en el padrón.',
  }),
]);

// Lo que venga de la API o de Firestore ('activo', 'Inactivo', 'banned'…) → uno
// de los cuatro. Lo desconocido o vacío cuenta como activo, igual que antes.
const SINONIMOS = new Map([
  ...['active', 'activo'].map((v) => [v, ESTATUS_MIEMBRO.ACTIVO]),
  ...['reclutamiento', 'necesita reclutamiento', 'necesita_reclutamiento', 'recruit'].map((v) => [
    v,
    ESTATUS_MIEMBRO.NECESITA_RECLUTAMIENTO,
  ]),
  ...['banned', 'inactivo', 'inactive', 'suspendido', 'bloqueado'].map((v) => [
    v,
    ESTATUS_MIEMBRO.INACTIVO,
  ]),
  ...['fallecido', 'deceased'].map((v) => [v, ESTATUS_MIEMBRO.FALLECIDO]),
]);

export const normalizarEstatusMiembro = (valor) =>
  SINONIMOS.get(
    String(valor ?? '')
      .trim()
      .toLowerCase()
  ) ?? ESTATUS_MIEMBRO.ACTIVO;

export const opcionEstatusMiembro = (valor) =>
  OPCIONES_ESTATUS_MIEMBRO.find((opcion) => opcion.value === normalizarEstatusMiembro(valor));
