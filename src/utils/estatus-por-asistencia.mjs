// ----------------------------------------------------------------------
// EL ESTATUS DEL MIEMBRO SE MUEVE CON LA ASISTENCIA.
//
// Antes el estatus lo cambiaba alguien a mano cuando se acordaba, así que un
// miembro que llevaba medio año sin venir seguía "Activo" y nadie lo reclutaba.
// Aquí vive la regla, sin Firebase ni React, para poder probarla entera:
//
//   - 3 faltas SEGUIDAS en reuniones → Necesita reclutamiento.
//   - 3 meses sin ninguna presencia → Inactivo (se calcula por fecha, no hace
//     falta que nadie pase lista).
//   - Desde Reclutamiento, 1 presencia → Activo.
//   - Desde Inactivo, 3 presencias SEGUIDAS → Activo.
//   - El miembro nuevo empieza en Reclutamiento y necesita 3 reuniones seguidas.
//   - Excusa y enfermo no son falta: cortan la racha de faltas, pero tampoco
//     cuentan como presencia, así que la regla de los 3 meses los baja igual.
//   - Un día sin reunión (feriado, campamento) no cuenta para nada.
//   - Fallecido no se mueve nunca: no cuenta faltas ni vuelve con una presencia.
//   - Un cambio a mano se respeta 30 días: si no, el pase de lista del sábado
//     deshacía lo que el coordinador puso el martes.
// ----------------------------------------------------------------------

import { ESTATUS_MIEMBRO, normalizarEstatusMiembro } from './estatus-miembro.mjs';

export const COLECCION_ESTATUS_MIEMBROS = 'estatus_miembros';

export const FALTAS_PARA_RECLUTAMIENTO = 3;
export const MESES_PARA_INACTIVO = 3;
export const PRESENCIAS_PARA_REACTIVAR = 3;
export const DIAS_DE_RESPETO_AL_CAMBIO_MANUAL = 30;
/** Cuántos días antes de los 3 meses se avisa de que va a caer a Inactivo. */
export const DIAS_DE_AVISO_ANTES_DE_INACTIVO = 14;

/** Quién movió el estatus. 'sistema' es la regla de asistencia. */
export const AUTOR_SISTEMA = 'sistema';

// Qué hace cada estado del pase de lista con las dos rachas.
const EFECTO = {
  presente: { falta: false, presencia: true },
  ausente: { falta: true, presencia: false },
  // Avisó: no se le cuenta la falta, pero tampoco estuvo.
  excusa: { falta: false, presencia: false },
  enfermo: { falta: false, presencia: false },
  otro: { falta: true, presencia: false },
};

const aFecha = (texto) => new Date(`${String(texto).slice(0, 10)}T12:00:00Z`);
const aTexto = (fecha) => fecha.toISOString().slice(0, 10);

export const mesesEntre = (desde, hasta) => {
  if (!desde || !hasta) return 0;

  const a = aFecha(desde);
  const b = aFecha(hasta);

  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;

  const meses =
    (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());

  return b.getUTCDate() < a.getUTCDate() ? meses - 1 : meses;
};

export const sumarDias = (texto, dias) => {
  const fecha = aFecha(texto);
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return aTexto(fecha);
};

/** El día en que, sin volver a venir, pasará a Inactivo. */
export const fechaLimiteDeInactividad = (fechaUltimaPresencia) => {
  if (!fechaUltimaPresencia) return '';

  const fecha = aFecha(fechaUltimaPresencia);
  fecha.setUTCMonth(fecha.getUTCMonth() + MESES_PARA_INACTIVO);

  return aTexto(fecha);
};

/** Lo que se guarda en `estatus_miembros/{idMiembros}`, con todo a cero. */
export const registroInicialDeEstatus = ({
  idMiembros,
  idDestacamento = '',
  estatus = ESTATUS_MIEMBRO.NECESITA_RECLUTAMIENTO,
  fechaUltimaPresencia = '',
  desde = '',
} = {}) => ({
  idMiembros: String(idMiembros ?? ''),
  idDestacamento: String(idDestacamento ?? ''),
  estatus: normalizarEstatusMiembro(estatus),
  faltasSeguidas: 0,
  presenciasSeguidas: 0,
  fechaUltimaPresencia: String(fechaUltimaPresencia ?? ''),
  desde: String(desde ?? ''),
  motivo: '',
  autor: AUTOR_SISTEMA,
  // Mientras esta fecha no pase, la regla no toca el estatus.
  respetarManualHasta: '',
});

const conEstatus = (registro, estatus, motivo, fecha) => ({
  ...registro,
  estatus,
  motivo,
  autor: AUTOR_SISTEMA,
  desde: fecha,
  faltasSeguidas: estatus === ESTATUS_MIEMBRO.ACTIVO ? 0 : registro.faltasSeguidas,
  presenciasSeguidas: estatus === ESTATUS_MIEMBRO.ACTIVO ? 0 : registro.presenciasSeguidas,
});

/** Un cambio a mano manda durante 30 días. */
export const laReglaPuedeMover = (registro = {}, hoy = '') =>
  !registro.respetarManualHasta || String(hoy) > String(registro.respetarManualHasta);

// ----------------------------------------------------------------------
// UN PASE DE LISTA
// ----------------------------------------------------------------------

// `esReunion`: solo las reuniones mueven las rachas. Una excursión o un
// campamento se pasan igual en la pantalla, pero no cuentan como reunión.
export const aplicarPaseDeLista = ({
  registro,
  estado = '',
  fecha = '',
  esReunion = true,
} = {}) => {
  const base = { ...registroInicialDeEstatus(registro ?? {}), ...(registro ?? {}) };
  const efecto = EFECTO[String(estado).trim().toLowerCase()];

  // Fallecido no se mueve ni marcándolo presente por error.
  if (base.estatus === ESTATUS_MIEMBRO.FALLECIDO) return base;
  if (!efecto || !fecha) return base;

  const siguiente = {
    ...base,
    faltasSeguidas: esReunion ? (efecto.falta ? base.faltasSeguidas + 1 : 0) : base.faltasSeguidas,
    presenciasSeguidas: esReunion
      ? efecto.presencia
        ? base.presenciasSeguidas + 1
        : 0
      : base.presenciasSeguidas,
    // La última presencia sí cuenta cualquier día: vino, aunque fuera a una
    // excursión, y por eso no se le empiezan a contar los tres meses.
    fechaUltimaPresencia: efecto.presencia ? String(fecha) : base.fechaUltimaPresencia,
  };

  if (!esReunion || !laReglaPuedeMover(base, fecha)) return siguiente;

  if (efecto.presencia) {
    // Reclutamiento vuelve con una; Inactivo y el miembro nuevo necesitan tres.
    const necesarias =
      siguiente.estatus === ESTATUS_MIEMBRO.NECESITA_RECLUTAMIENTO && siguiente.desde
        ? 1
        : PRESENCIAS_PARA_REACTIVAR;

    if (
      siguiente.estatus !== ESTATUS_MIEMBRO.ACTIVO &&
      siguiente.presenciasSeguidas >= necesarias
    ) {
      return conEstatus(
        siguiente,
        ESTATUS_MIEMBRO.ACTIVO,
        necesarias === 1 ? 'Volvió a la reunión.' : `Asistió a ${necesarias} reuniones seguidas.`,
        String(fecha)
      );
    }

    return siguiente;
  }

  if (
    siguiente.estatus === ESTATUS_MIEMBRO.ACTIVO &&
    siguiente.faltasSeguidas >= FALTAS_PARA_RECLUTAMIENTO
  ) {
    return conEstatus(
      siguiente,
      ESTATUS_MIEMBRO.NECESITA_RECLUTAMIENTO,
      `Faltó a ${siguiente.faltasSeguidas} reuniones seguidas.`,
      String(fecha)
    );
  }

  return siguiente;
};

// ----------------------------------------------------------------------
// EL PASO DEL TIEMPO (3 MESES SIN VENIR)
//
// No lo dispara ningún pase de lista: se calcula al abrir la lista del
// destacamento, con la fecha de hoy.
// ----------------------------------------------------------------------

export const evaluarPorTiempo = ({ registro, hoy = '' } = {}) => {
  const base = { ...registroInicialDeEstatus(registro ?? {}), ...(registro ?? {}) };

  if (
    !hoy ||
    base.estatus === ESTATUS_MIEMBRO.FALLECIDO ||
    base.estatus === ESTATUS_MIEMBRO.INACTIVO ||
    !laReglaPuedeMover(base, hoy)
  ) {
    return base;
  }

  // Sin ninguna presencia se cuenta desde que entró (`desde`): si no, un
  // miembro que nunca vino no bajaría nunca.
  const referencia = base.fechaUltimaPresencia || base.desde;

  if (!referencia || mesesEntre(referencia, hoy) < MESES_PARA_INACTIVO) return base;

  return conEstatus(
    base,
    ESTATUS_MIEMBRO.INACTIVO,
    base.fechaUltimaPresencia
      ? `Lleva ${MESES_PARA_INACTIVO} meses sin asistir (última vez: ${base.fechaUltimaPresencia}).`
      : `Nunca ha asistido en ${MESES_PARA_INACTIVO} meses.`,
    String(hoy)
  );
};

/** Aviso previo: le quedan pocos días para caer a Inactivo. */
export const estaPorCaerEnInactivo = ({ registro, hoy = '' } = {}) => {
  const base = { ...registroInicialDeEstatus(registro ?? {}), ...(registro ?? {}) };
  const referencia = base.fechaUltimaPresencia || base.desde;

  if (
    !hoy ||
    !referencia ||
    base.estatus === ESTATUS_MIEMBRO.FALLECIDO ||
    base.estatus === ESTATUS_MIEMBRO.INACTIVO
  ) {
    return false;
  }

  const limite = fechaLimiteDeInactividad(referencia);

  return String(hoy) >= sumarDias(limite, -DIAS_DE_AVISO_ANTES_DE_INACTIVO) && String(hoy) < limite;
};

// ----------------------------------------------------------------------
// UN CAMBIO A MANO
// ----------------------------------------------------------------------

export const aplicarCambioManual = ({
  registro,
  estatus,
  motivo = '',
  autor = '',
  hoy = '',
} = {}) => {
  const base = { ...registroInicialDeEstatus(registro ?? {}), ...(registro ?? {}) };
  const destino = normalizarEstatusMiembro(estatus);

  return {
    ...base,
    estatus: destino,
    motivo: String(motivo ?? '').trim(),
    autor: String(autor ?? '').trim() || 'manual',
    desde: String(hoy),
    faltasSeguidas: destino === ESTATUS_MIEMBRO.ACTIVO ? 0 : base.faltasSeguidas,
    presenciasSeguidas: 0,
    respetarManualHasta: sumarDias(hoy, DIAS_DE_RESPETO_AL_CAMBIO_MANUAL),
  };
};

/** Al cambiar de destacamento las rachas empiezan de cero; el estatus no cambia. */
export const reiniciarPorCambioDeDestacamento = ({ registro, idDestacamento = '' } = {}) => ({
  ...registroInicialDeEstatus(registro ?? {}),
  ...(registro ?? {}),
  idDestacamento: String(idDestacamento ?? ''),
  faltasSeguidas: 0,
  presenciasSeguidas: 0,
});

// ----------------------------------------------------------------------
// POR QUÉ ESTÁ ASÍ (lo que se lee al pasar el ratón por el chip)
// ----------------------------------------------------------------------

export const explicarEstatus = (registro = {}) => {
  const base = { ...registroInicialDeEstatus(registro ?? {}), ...(registro ?? {}) };
  const partes = [];

  if (base.motivo) partes.push(base.motivo);
  partes.push(
    base.fechaUltimaPresencia
      ? `Última presencia: ${base.fechaUltimaPresencia}.`
      : 'Sin ninguna presencia registrada.'
  );
  if (base.faltasSeguidas > 0) partes.push(`${base.faltasSeguidas} faltas seguidas.`);
  if (base.presenciasSeguidas > 0) partes.push(`${base.presenciasSeguidas} presencias seguidas.`);
  if (base.autor !== AUTOR_SISTEMA) partes.push(`Puesto a mano por ${base.autor}.`);

  return partes.join(' ');
};
