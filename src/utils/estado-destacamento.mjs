// ----------------------------------------------------------------------
// ESTADO DEL DESTACAMENTO (Activo / Inactivo).
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
  activo: 'activo',
  inactivo: 'inactivo',
};

export const OPCIONES_ESTADO_DESTACAMENTO = [
  { value: ESTADOS_DESTACAMENTO.activo, label: 'Activo' },
  { value: ESTADOS_DESTACAMENTO.inactivo, label: 'Inactivo' },
];

/** Lo que venga (ausente, mayúsculas, basura) acaba en uno de los dos estados. */
export const normalizarEstadoDestacamento = (valor) =>
  String(valor ?? '').trim().toLowerCase() === ESTADOS_DESTACAMENTO.inactivo
    ? ESTADOS_DESTACAMENTO.inactivo
    : ESTADOS_DESTACAMENTO.activo;

export const etiquetaEstadoDestacamento = (valor) =>
  OPCIONES_ESTADO_DESTACAMENTO.find((o) => o.value === normalizarEstadoDestacamento(valor)).label;
