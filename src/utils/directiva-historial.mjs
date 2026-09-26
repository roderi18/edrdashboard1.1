// ----------------------------------------------------------------------
// HISTORIAL DE OCUPANTES DE UN CARGO DE DIRECTIVA (nacional, regional,
// seccional o destacamento).
//
// Hoy una casilla de directiva es UN SOLO documento por casilla: cambiar de
// persona sobreescribe, y quien la ocupaba antes desaparece sin dejar rastro.
// Este modulo decide CUANDO esa salida merece quedar guardada (30 dias
// calendario minimo, para no ensuciar el historial con correcciones rapidas) y
// arma la fila que se guarda. Puro: sin Firestore ni fechas "de hoy" ocultas.
// ----------------------------------------------------------------------

import { DIRECTIVA_POSITIONS } from '../catalogs/directiva-positions.js';

export const COLECCION_HISTORIAL_DIRECTIVA = 'directiva_historial_ocupantes';

// Los niveles que entran en la vista GLOBAL de Historia del Consejo Nacional.
// Destacamento se ve solo, uno por uno, en su propia pestaña.
export const NIVELES_HISTORIAL_NACIONAL = Object.freeze(['nacional', 'regional', 'seccional']);

export const MINIMO_DIAS_HISTORIAL = 30;

const POSICION_POR_ID = new Map(
  DIRECTIVA_POSITIONS.map((posicion) => [posicion.idCargo, posicion])
);

// El nombre del cargo para pintar la fila: ni el historial ni la asignacion
// viva guardan el nombre, solo el id de la posicion.
export const nombreDeCargoPorPosicion = (idPosicionDirectiva) =>
  POSICION_POR_ID.get(String(idPosicionDirectiva || ''))?.nombreCargo || 'Cargo';

const aFecha = (valor) => {
  if (!valor) return null;
  const fecha = valor instanceof Date ? valor : new Date(`${String(valor).slice(0, 10)}T00:00:00`);

  return Number.isNaN(fecha.getTime()) ? null : fecha;
};

const MS_POR_DIA = 24 * 60 * 60 * 1000;

/** Dias calendario completos entre dos fechas (strings "YYYY-MM-DD" o Date). */
export const diasEntre = (desde, hasta) => {
  const fechaDesde = aFecha(desde);
  const fechaHasta = aFecha(hasta);

  if (!fechaDesde || !fechaHasta) return 0;

  return Math.round((fechaHasta.getTime() - fechaDesde.getTime()) / MS_POR_DIA);
};

/**
 * ¿La salida de `anterior` merece quedar en el historial?
 *
 *  - No hay a quien sacar (casilla ya vacia, o sin ocupante activo): no.
 *  - Sigue siendo la misma persona (no cambio nada): no.
 *  - Llevaba menos de 30 dias: no, es como si nunca hubiera estado.
 */
export const debeRegistrarSalida = ({
  anterior,
  siguienteIdMiembro = '',
  siguienteActivo = true,
  fechaSalida,
} = {}) => {
  if (!anterior?.activo || !anterior?.idMiembro) return false;

  const cambioDePersona = String(anterior.idMiembro) !== String(siguienteIdMiembro || '');
  const sigueOcupada = Boolean(siguienteActivo) && Boolean(siguienteIdMiembro);

  if (sigueOcupada && !cambioDePersona) return false;

  return diasEntre(anterior.fechaInicio, fechaSalida) >= MINIMO_DIAS_HISTORIAL;
};

/**
 * La fila que se guarda para quien sale. El id es estable por SALIDA (casilla +
 * fecha de salida), no por casilla: asi una misma casilla puede acumular varias
 * filas en el tiempo en vez de que la siguiente pise a esta.
 */
export const construirRegistroHistorial = ({ anterior, idAsignacion, fechaSalida }) => ({
  id: `${idAsignacion}__${fechaSalida}`,
  idAsignacion,
  nivel: anterior.nivel,
  idEntidad: String(anterior.idEntidad ?? ''),
  idPosicionDirectiva: anterior.idPosicionDirectiva ?? '',
  idMiembro: String(anterior.idMiembro ?? ''),
  nombreMiembro: anterior.nombreMiembro ?? '',
  codigoMiembro: anterior.codigoMiembro ?? '',
  fotoMiembro: anterior.fotoMiembro ?? '',
  fechaInicio: anterior.fechaInicio,
  fechaFin: fechaSalida,
});

const nombreDeFila = (fila = {}) =>
  fila.nombreMiembro || [fila.nombres, fila.apellidos].filter(Boolean).join(' ') || '';

/**
 * Historial (quienes salieron) + vigentes (quien esta hoy) en una sola lista
 * lista para pintar: vigentes primero, y el resto por fecha de salida mas
 * reciente. Ninguna de las dos listas se muta.
 *
 * `resolverEntidadNombre(idEntidad, nivel)` es opcional: solo hace falta en la
 * vista GLOBAL del Consejo Nacional, donde una fila puede ser de cualquier
 * región o sección y hay que decir de cuál.
 */
export const combinarHistorialYVigentes = ({
  historial = [],
  vigentes = [],
  resolverEntidadNombre = () => '',
} = {}) => {
  const conCamposComunes = (fila, vigente) => ({
    id: fila.id || fila.idAsignacion,
    nivel: fila.nivel,
    idEntidad: String(fila.idEntidad ?? ''),
    idPosicionDirectiva: fila.idPosicionDirectiva ?? '',
    idMiembro: String(fila.idMiembro ?? ''),
    nombreMiembro: nombreDeFila(fila),
    codigoMiembro: fila.codigoMiembro ?? '',
    fotoMiembro: fila.fotoMiembro ?? fila.avatarUrl ?? '',
    cargoNombre:
      fila.cargoNombre || nombreDeCargoPorPosicion(fila.idPosicionDirectiva ?? fila.idCargo),
    entidadNombre:
      fila.entidadNombre ||
      fila.nombreEntidad ||
      resolverEntidadNombre(fila.idEntidad, fila.nivel) ||
      '',
    fechaInicio: fila.fechaInicio,
    fechaFin: vigente ? null : fila.fechaFin,
    vigente,
  });

  const filas = [
    ...vigentes.map((fila) => conCamposComunes(fila, true)),
    ...historial.map((fila) => conCamposComunes(fila, false)),
  ];

  return filas.sort((a, b) => {
    if (a.vigente !== b.vigente) return a.vigente ? -1 : 1;

    return String(b.fechaFin || b.fechaInicio || '').localeCompare(
      String(a.fechaFin || a.fechaInicio || '')
    );
  });
};
