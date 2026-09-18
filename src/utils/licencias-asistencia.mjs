// ----------------------------------------------------------------------
// "OTRO" EN EL PASE DE LISTA: MOTIVOS, Y LA LICENCIA DE VARIOS DÍAS.
//
// "Otro" era una marca suelta: no decía por qué, y quien se iba un mes (viaje,
// trabajo, estudios) salía "Ausente" cada sábado que nadie se acordaba de
// marcarlo. Eso le sumaba faltas seguidas y lo bajaba a Reclutamiento o a
// Inactivo sin haber dejado de pertenecer al destacamento.
//
// Una licencia es un rango de días de UN miembro. Mientras dure, el pase de
// lista lo pone solo como "Otro · De licencia" en vez de ausente, y la regla del
// estatus no le cuenta la falta. Fechas como texto 'YYYY-MM-DD', igual que la
// asistencia guardada. Sin React ni Firebase, para probarlo con `node --test`.
// ----------------------------------------------------------------------

export const COLECCION_LICENCIAS_ASISTENCIA = 'licenciasAsistencia';

/** El detalle que se guarda junto a un "Otro" en el registro de asistencia. */
export const MOTIVOS_OTRO = Object.freeze([
  Object.freeze({
    value: 'licencia',
    label: 'De licencia',
    descripcion: 'Ausente con permiso durante varios días; no cuenta como falta.',
    pideDias: true,
  }),
  // Apartado por el destacamento durante unos días. No es una falta suya: si
  // contara, la suspensión le sumaría además un cambio de estatus.
  Object.freeze({
    value: 'suspension',
    label: 'Suspensión disciplinaria',
    descripcion: 'Apartado de las reuniones durante unos días; no cuenta como falta.',
    pideDias: true,
  }),
]);

export const motivoOtro = (valor) => MOTIVOS_OTRO.find((motivo) => motivo.value === valor) ?? null;

export const MOTIVO_LICENCIA = 'licencia';
export const MOTIVO_SUSPENSION = 'suspension';

/** Motivos que cubren un rango de días y se guardan en `licenciasAsistencia`. */
export const esMotivoConDias = (valor) => Boolean(motivoOtro(valor)?.pideDias);

/** Atajos del selector; se puede escribir cualquier cantidad hasta el máximo. */
export const DIAS_SUGERIDOS_LICENCIA = Object.freeze([7, 14, 30, 60, 90]);
export const MAXIMO_DIAS_LICENCIA = 180;

const PATRON_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const aFecha = (texto) => new Date(`${texto}T12:00:00Z`);
const aTexto = (fecha) => fecha.toISOString().slice(0, 10);

export const etiquetaDeOtro = (detalle) => {
  const motivo = motivoOtro(detalle);
  return motivo ? `Otro · ${motivo.label}` : 'Otro';
};

/** Por qué no se acepta una licencia, o '' si se acepta. */
export const motivoLicenciaInvalida = ({ fechaInicio, dias } = {}) => {
  if (!PATRON_FECHA.test(String(fechaInicio ?? ''))) return 'Falta el día en que empieza.';

  const numero = Number(dias);

  if (!Number.isInteger(numero) || numero < 1) return 'Elige al menos un día.';
  if (numero > MAXIMO_DIAS_LICENCIA) {
    return `Una licencia dura como máximo ${MAXIMO_DIAS_LICENCIA} días.`;
  }

  return '';
};

// `dias` incluye el primero: una licencia de 7 días que empieza el sábado 5
// termina el viernes 11, y el sábado 12 ya vuelve a contar.
export const rangoDeLicencia = ({ fechaInicio, dias }) => {
  const fin = aFecha(fechaInicio);
  fin.setUTCDate(fin.getUTCDate() + Number(dias) - 1);

  return { fechaInicio: String(fechaInicio), fechaFin: aTexto(fin) };
};

export const idDeLicencia = ({ idMiembro, fechaInicio }) =>
  `${String(idMiembro).trim()}_${String(fechaInicio)}`;

export const licenciaCubreFecha = (licencia, fecha) =>
  Boolean(licencia?.fechaInicio && licencia?.fechaFin) &&
  String(fecha) >= licencia.fechaInicio &&
  String(fecha) <= licencia.fechaFin;

/** idMiembro → licencia vigente ese día (si hay dos, la que empezó después). */
export const licenciasEnFecha = (licencias = [], fecha = '') => {
  const vigentes = new Map();

  (Array.isArray(licencias) ? licencias : [])
    .filter((licencia) => licenciaCubreFecha(licencia, fecha))
    .sort((a, b) => a.fechaInicio.localeCompare(b.fechaInicio))
    .forEach((licencia) => vigentes.set(String(licencia.idMiembro), licencia));

  return vigentes;
};
