// ----------------------------------------------------------------------
// ESTADO DE UN REPORTE DE PROBLEMA (tarjeta roja del chat de Administradores
// Globales). Abierto → En progreso → Resuelto; desde Resuelto se puede reabrir.
// Un reporte sin estado es Abierto (los de antes no lo guardaban).
// ----------------------------------------------------------------------

export const ESTADOS_REPORTE = {
  abierto: 'abierto',
  enProgreso: 'en_progreso',
  resuelto: 'resuelto',
};

const ETIQUETAS = {
  abierto: 'Abierto',
  en_progreso: 'En progreso',
  resuelto: 'Resuelto',
};

// Color del tema para la tarjeta y el chip.
export const COLOR_ESTADO_REPORTE = {
  abierto: 'error',
  en_progreso: 'warning',
  resuelto: 'success',
};

export const esEstadoDeReporte = (valor) => Object.values(ESTADOS_REPORTE).includes(valor);

export const normalizarEstadoReporte = (valor) =>
  esEstadoDeReporte(valor) ? valor : ESTADOS_REPORTE.abierto;

export const etiquetaEstadoReporte = (valor) => ETIQUETAS[normalizarEstadoReporte(valor)];
