// ----------------------------------------------------------------------
// LO QUE SE CALCULA AL PINTAR, NO AL PUBLICAR.
//
// Los "días que faltan" de la próxima actividad se escribian a mano: un numero
// fijo que el dia siguiente ya era mentira. Desde la fase 4, si el bloque trae su
// fecha de inicio, el numero —y el texto de las fechas— se calcula CADA VEZ que
// se pinta la tarjeta, con el dia de hoy.
//
// Y un evento con fecha deja de enseñarse cuando esa fecha ya paso, sin que nadie
// tenga que acordarse de quitarlo.
//
// SIN FECHA, NADA CAMBIA. El valor de fabrica no trae fechas: estas funciones le
// devuelven EXACTAMENTE lo que recibieron —el mismo objeto—, para que la portada
// sin publicar se siga viendo como siempre.
//
// Todo se cuenta en dias de calendario de la Republica Dominicana, que no cambia
// de hora: una actividad del dia 26 falta "1 dia" durante todo el 25, se abra a
// las 00:05 o a las 23:55.
// ----------------------------------------------------------------------

import { fechaISO } from './saneado.mjs';

export const ZONA_HORARIA = 'America/Santo_Domingo';

const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

/** Las tres letras que usa la hoja de calendario de "Próximos eventos". */
export const MESES_ABREVIADOS = [
  'ENE',
  'FEB',
  'MAR',
  'ABR',
  'MAY',
  'JUN',
  'JUL',
  'AGO',
  'SEP',
  'OCT',
  'NOV',
  'DIC',
];

const partesDe = (iso) => {
  const [anio, mes, dia] = iso.split('-').map(Number);

  return { anio, mes, dia };
};

const diaJuliano = (iso) => {
  const { anio, mes, dia } = partesDe(iso);

  return Math.round(Date.UTC(anio, mes - 1, dia) / 86_400_000);
};

/** Hoy, como `AAAA-MM-DD`, en la hora de la Republica Dominicana. */
export function hoyISO(ahora = new Date()) {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: ZONA_HORARIA,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .formatToParts(ahora)
      .map((parte) => [parte.type, parte.value])
  );

  return `${partes.year}-${partes.month}-${partes.day}`;
}

/** Dias de calendario desde hoy hasta la fecha. Nunca negativo. */
export const diasHasta = (fecha, hoy) => Math.max(0, diaJuliano(fecha) - diaJuliano(hoy));

/**
 * "26 — 28 septiembre 2026", con el mismo estilo que el valor de fabrica.
 * Un solo dia: "26 septiembre 2026". Meses o años distintos, cada lado completo.
 */
export function textoDeFechas(inicio, fin) {
  const a = partesDe(inicio);

  if (!fin || fin === inicio) return `${a.dia} ${MESES[a.mes - 1]} ${a.anio}`;

  const b = partesDe(fin);

  if (a.anio !== b.anio) {
    return `${a.dia} ${MESES[a.mes - 1]} ${a.anio} — ${b.dia} ${MESES[b.mes - 1]} ${b.anio}`;
  }

  if (a.mes !== b.mes) {
    return `${a.dia} ${MESES[a.mes - 1]} — ${b.dia} ${MESES[b.mes - 1]} ${b.anio}`;
  }

  return `${a.dia} — ${b.dia} ${MESES[b.mes - 1]} ${b.anio}`;
}

/** "13 sep 2026", como los comunicados de fabrica. */
export function fechaCorta(fecha) {
  const { anio, mes, dia } = partesDe(fecha);

  return `${String(dia).padStart(2, '0')} ${MESES_ABREVIADOS[mes - 1].toLowerCase()} ${anio}`;
}

/** `{ dia: '26', mes: 'SEP' }` para la hoja de calendario de un evento. */
export function diaYMes(fecha) {
  const { mes, dia } = partesDe(fecha);

  return { dia: String(dia).padStart(2, '0'), mes: MESES_ABREVIADOS[mes - 1] };
}

/**
 * La proxima actividad lista para pintar. Con fecha de inicio, las fechas y los
 * dias salen del calendario; sin ella, se devuelve tal cual (el mismo objeto).
 */
export function actividadParaPintar(actividad, hoy = hoyISO()) {
  if (!actividad || !fechaISO(actividad.fechaInicio)) return actividad;

  const fin = fechaISO(actividad.fechaFin) ? actividad.fechaFin : actividad.fechaInicio;

  return {
    ...actividad,
    fechas: textoDeFechas(actividad.fechaInicio, fin),
    diasQueFaltan: diasHasta(actividad.fechaInicio, hoy),
  };
}

/**
 * Los eventos que todavia no pasaron. Uno sin fecha se enseña siempre. Si
 * ninguno trae fecha, se devuelve la misma lista.
 */
export function eventosVigentes(eventos, hoy = hoyISO()) {
  if (!Array.isArray(eventos) || !eventos.some((evento) => fechaISO(evento?.fecha))) {
    return eventos;
  }

  return eventos.filter((evento) => !fechaISO(evento?.fecha) || evento.fecha >= hoy);
}

/**
 * Al reves que `fechaCorta`: "13 sep 2026" → "2026-09-13", o `null` si no se
 * reconoce. Lo usa el editor de comunicados para abrir el calendario en la fecha
 * que ya tenia escrita un comunicado.
 */
export function fechaCortaAISO(texto) {
  const partes = /^(\d{1,2}) ([a-z]{3}) (\d{4})$/.exec(
    String(texto ?? '')
      .trim()
      .toLowerCase()
  );

  if (!partes) return null;

  const mes = MESES_ABREVIADOS.findIndex((abreviado) => abreviado.toLowerCase() === partes[2]);

  if (mes < 0) return null;

  return fechaISO(`${partes[3]}-${String(mes + 1).padStart(2, '0')}-${partes[1].padStart(2, '0')}`);
}
