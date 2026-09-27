// ----------------------------------------------------------------------
// ESTADO DEL DESTACAMENTO (Registrado / Activo / Inactivo / No reconocido).
//
// Lo lleva el registro nacional, igual que el número: solo lo mueven el
// Administrador Global y la Oficina Nacional (`puedeCambiarEstadoDeDestacamento`).
// La API .NET no tiene un campo para esto, así que vive en Firestore
// (`estado_destacamentos/{idDestacamento}`). Un destacamento sin documento es
// Activo: todos los que ya existían lo eran, y marcarlos a mano uno por uno no
// tenía sentido.
// ----------------------------------------------------------------------

export const COLECCION_ESTADO_DESTACAMENTOS = 'estado_destacamentos';

export const ESTADOS_DESTACAMENTO = {
  registrado: 'registrado',
  activo: 'activo',
  inactivo: 'inactivo',
  noReconocido: 'no_reconocido',
};

// En este orden salen en el desplegable.
export const OPCIONES_ESTADO_DESTACAMENTO = [
  {
    value: ESTADOS_DESTACAMENTO.registrado,
    label: 'Registrado',
    descripcion: 'Destacamento activo y paga su renovación de membresía a la Oficina Nacional.',
  },
  {
    value: ESTADOS_DESTACAMENTO.activo,
    label: 'Activo',
    descripcion: 'Destacamento activo, pero no paga su renovación.',
  },
  {
    value: ESTADOS_DESTACAMENTO.inactivo,
    label: 'Inactivo',
    descripcion: 'Destacamento no funciona en la iglesia local.',
  },
  {
    value: ESTADOS_DESTACAMENTO.noReconocido,
    label: 'No reconocido',
    descripcion: 'Destacamento en formación, sin número asignado.',
  },
];

const VALORES = new Set(Object.values(ESTADOS_DESTACAMENTO));

/** Lo que venga (ausente, mayúsculas, "No reconocido", basura) acaba en uno de los cuatro. */
export const normalizarEstadoDestacamento = (valor) => {
  const limpio = String(valor ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
  return VALORES.has(limpio) ? limpio : ESTADOS_DESTACAMENTO.activo;
};

// Color del Label en las listas (paleta del tema).
export const COLOR_ESTADO_DESTACAMENTO = {
  registrado: 'success',
  activo: 'info',
  inactivo: 'error',
  no_reconocido: 'default',
};

export const etiquetaEstadoDestacamento = (valor) =>
  OPCIONES_ESTADO_DESTACAMENTO.find((o) => o.value === normalizarEstadoDestacamento(valor)).label;
