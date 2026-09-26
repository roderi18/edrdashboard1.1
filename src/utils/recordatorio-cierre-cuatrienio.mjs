// ----------------------------------------------------------------------
// RECORDATORIO DE CIERRE DEL CUATRIENIO.
//
// El 22/08 empieza la nueva Directiva Nacional y, si nadie pulsó "Guardar en la
// memoria" antes, la directiva que termina no queda guardada como la de su
// cuatrienio. Nada lo recordaba. Ahora el Administrador Global y la Oficina
// Nacional reciben un aviso en la campana a 30, 7 y 1 día del cierre.
//
// Cada tramo es un aviso con id fijo: se crea una sola vez, lo mande quien lo
// mande primero, y entrar otra vez no lo vuelve a marcar como no leído.
// Días en hora de Santo Domingo (`hoyISO`), como el resto de la aplicación.
// ----------------------------------------------------------------------

import { CUATRIENIOS } from './directiva-cuatrienios.mjs';
import { hoyISO, diasHasta } from './everest/presentacion.mjs';

export const TRAMOS_RECORDATORIO_CIERRE = Object.freeze([30, 7, 1]);

export const TIPO_RECORDATORIO_CIERRE = 'cierre_cuatrienio_directiva';

/**
 * El recordatorio que toca hoy, o null. `tramo` es el menor de 30/7/1 que
 * alcanza a los días que faltan: con 20 días toca el de 30 (si ya se mandó, no
 * se repite); con 5, el de 7.
 */
export const recordatorioDeCierre = ({ ahora = new Date(), cuatrienios = CUATRIENIOS } = {}) => {
  const hoy = hoyISO(ahora);
  // `fin` es exclusivo: el 22/08/2030 ya es el cuatrienio nuevo.
  const vigente = cuatrienios.find((item) => item.inicio <= hoy && hoy < item.fin);

  if (!vigente) return null;

  const dias = diasHasta(vigente.fin, hoy);
  const tramo = [...TRAMOS_RECORDATORIO_CIERRE].sort((a, b) => a - b).find((t) => dias <= t);

  if (!dias || !tramo) return null;

  return {
    id: `${TIPO_RECORDATORIO_CIERRE}_${vigente.id}_${tramo}`,
    cuatrienio: vigente.id,
    fin: vigente.fin,
    dias,
    tramo,
  };
};

// Con 1 día, hoy ES el último: `fin` ya es el primer día de la nueva directiva.
export const textoDelRecordatorio = ({ cuatrienio, dias }) =>
  dias === 1
    ? `Hoy es el último día de la Directiva Nacional ${cuatrienio}. Guárdala hoy en su memoria desde la lista del Consejo Nacional.`
    : `A la Directiva Nacional ${cuatrienio} le quedan ${dias} días. Recuerda guardarla en su memoria desde la lista del Consejo Nacional.`;
