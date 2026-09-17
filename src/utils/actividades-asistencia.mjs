// ----------------------------------------------------------------------
// ACTIVIDADES EN EL CALENDARIO DE ASISTENCIA.
//
// El calendario solo dejaba abrir el dia de reunion del destacamento y nunca un
// dia futuro. Eso sirve para la reunion semanal, pero no para pasar lista en una
// actividad que cae otro dia —una excursion, un servicio, un campamento de tres
// dias que empieza mañana—: no habia forma de elegir esa fecha.
//
// Una actividad es un dia o un rango de dias de un destacamento. Sus dias se
// pueden abrir SIEMPRE, sean o no de reunion y aunque todavia no hayan llegado.
// Las fechas van como texto 'YYYY-MM-DD', igual que en la asistencia guardada.
// ----------------------------------------------------------------------

/** Un rango mas largo es casi seguro un error al pulsar el calendario. */
export const MAX_DIAS_ACTIVIDAD = 31;

const PATRON_FECHA = /^\d{4}-\d{2}-\d{2}$/;

// A mediodia UTC: asi sumar un dia nunca cae en otro por el cambio de horario.
const aFecha = (texto) => new Date(`${texto}T12:00:00Z`);
const aTexto = (fecha) => fecha.toISOString().slice(0, 10);

export const esFechaValida = (texto) =>
  PATRON_FECHA.test(String(texto || '')) && !Number.isNaN(aFecha(texto).getTime());

/** 0 = domingo … 6 = sabado, como `dayjs().day()`. */
export const diaDeLaSemana = (texto) => aFecha(texto).getUTCDay();

/** Se puede pulsar primero el ultimo dia: el rango se ordena solo. */
export const ordenarRango = (fechaA, fechaB = fechaA) => {
  const b = fechaB || fechaA;

  return fechaA <= b ? { fechaInicio: fechaA, fechaFin: b } : { fechaInicio: b, fechaFin: fechaA };
};

/** Todos los dias del rango, los dos extremos incluidos. */
export const diasDelRango = (fechaInicio, fechaFin = fechaInicio) => {
  if (!esFechaValida(fechaInicio) || !esFechaValida(fechaFin)) return [];

  const { fechaInicio: desde, fechaFin: hasta } = ordenarRango(fechaInicio, fechaFin);
  const dias = [];

  for (
    let dia = aFecha(desde);
    aTexto(dia) <= hasta && dias.length <= MAX_DIAS_ACTIVIDAD;
    dia.setUTCDate(dia.getUTCDate() + 1)
  ) {
    dias.push(aTexto(dia));
  }

  return dias;
};

/** Por que no se acepta un rango, o '' si se acepta. */
export const motivoRangoInvalido = (fechaInicio, fechaFin = fechaInicio) => {
  if (!esFechaValida(fechaInicio) || !esFechaValida(fechaFin || fechaInicio)) {
    return 'Elige el día de la actividad.';
  }

  if (diasDelRango(fechaInicio, fechaFin).length > MAX_DIAS_ACTIVIDAD) {
    return `Una actividad no puede durar más de ${MAX_DIAS_ACTIVIDAD} días.`;
  }

  return '';
};

/** Los dias que cubren las actividades de un destacamento. */
export const fechasConActividad = (actividades = []) =>
  new Set(
    actividades.flatMap((actividad) => diasDelRango(actividad?.fechaInicio, actividad?.fechaFin))
  );

/** La actividad que cubre un dia; sirve para nombrarla y administrarla desde el calendario. */
export const actividadEnFecha = (actividades = [], fecha = '') =>
  actividades.find((actividad) => {
    if (!esFechaValida(fecha)) return false;

    const { fechaInicio, fechaFin } = ordenarRango(
      actividad?.fechaInicio || '',
      actividad?.fechaFin || actividad?.fechaInicio || ''
    );

    return esFechaValida(fechaInicio) && fecha >= fechaInicio && fecha <= fechaFin;
  }) ?? null;

/**
 * Si un dia se puede abrir para pasar lista. Un dia de actividad, siempre; los
 * demas, solo si ya llego y es el dia de reunion (cuando la ficha lo dice).
 */
export const fechaSeleccionable = ({
  fecha,
  hoy,
  diaDeReunion = null,
  conActividad = new Set(),
}) => {
  if (!esFechaValida(fecha)) return false;
  if (conActividad.has(fecha)) return true;
  if (fecha > hoy) return false;

  return (
    diaDeReunion === null || diaDeReunion === undefined || diaDeLaSemana(fecha) === diaDeReunion
  );
};

/**
 * La fecha a la que se lleva una que no se puede abrir: hacia atras, al ultimo
 * dia de reunion ya celebrado. Una fecha de actividad se respeta tal cual —antes
 * se habria corregido a hoy, y la actividad de mañana no se podia abrir nunca—.
 */
export const corregirFechaDeAsistencia = ({
  fecha,
  hoy,
  diaDeReunion = null,
  conActividad = new Set(),
}) => {
  if (!esFechaValida(fecha) || conActividad.has(fecha)) return fecha;

  const base = fecha > hoy ? hoy : fecha;

  if (diaDeReunion === null || diaDeReunion === undefined) return base;

  const dia = aFecha(base);

  dia.setUTCDate(dia.getUTCDate() - ((dia.getUTCDay() - diaDeReunion + 7) % 7));

  return aTexto(dia);
};
