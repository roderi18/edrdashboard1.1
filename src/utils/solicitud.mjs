import { hoyEnSantoDomingo } from './configuracion-membresia.mjs';

// ----------------------------------------------------------------------
// El código corto de una solicitud ("ONERRD-2027-18-3F9A"): se dicta por
// teléfono y se copia con un botón, en vez del UUID de 36 caracteres. Sale de
// la referencia (no se guarda aparte), así que también vale para las
// solicitudes de antes. Un destacamento tiene una solicitud a la vez.
// ----------------------------------------------------------------------

export const codigoDeSolicitud = (numero, referencia) => {
  const hex = String(referencia || '')
    .replace(/[^0-9a-f]/gi, '')
    .slice(0, 4)
    .toUpperCase();
  return `ONERRD-2027-${String(numero ?? '').trim() || 'SN'}-${hex || '0000'}`;
};

// La membresía dura un año desde el momento en que se coloca el pago: del día
// de hoy a la misma fecha del año siguiente (29 de febrero → 28), DD/MM/AAAA.
export function vigenciaDesdeHoy(ahora = new Date()) {
  const [anio, mes, dia] = hoyEnSantoDomingo(ahora).split('-').map(Number);
  const existe = new Date(Date.UTC(anio + 1, mes - 1, dia)).getUTCMonth() === mes - 1;
  const p = (n) => String(n).padStart(2, '0');
  return {
    desde: `${p(dia)}/${p(mes)}/${anio}`,
    hasta: `${p(existe ? dia : 28)}/${p(mes)}/${anio + 1}`,
  };
}
