// ----------------------------------------------------------------------
// CARGAR POR CAMPOS: QUÉ DATOS DE UN ENVÍO SE APLICAN.
//
// "Cargar" y "Volver a cargar" aplicaban el envío entero: para arreglar un
// teléfono había que aceptar también el nombre, la dirección o el coordinador
// que traía, aunque alguien los hubiera corregido a mano después. Ahora quien
// revisa elige los campos, ve antes qué cambiaría y solo se escribe lo que
// difiere de lo que ya hay en la aplicación.
// ----------------------------------------------------------------------

export const GRUPOS_DE_CAMPOS = [
  {
    grupo: 'Destacamento',
    campos: [
      { id: 'destNombre', etiqueta: 'Nombre' },
      { id: 'destNumero', etiqueta: 'Número' },
      { id: 'destDireccion', etiqueta: 'Dirección' },
      { id: 'destRegistradoOfnc', etiqueta: 'Registrado en Oficina Nacional' },
      { id: 'destRritrack', etiqueta: 'RRITrack activo' },
      { id: 'destDia', etiqueta: 'Día de reunión' },
      { id: 'destHora', etiqueta: 'Hora de reunión' },
      { id: 'destTelefono', etiqueta: 'Teléfono (el del pastor, si no tiene)' },
      { id: 'destLogo', etiqueta: 'Logo' },
    ],
  },
  {
    grupo: 'Iglesia',
    campos: [
      { id: 'iglesiaNombre', etiqueta: 'Nombre de la iglesia' },
      { id: 'iglesiaPastor', etiqueta: 'Pastor' },
      { id: 'iglesiaTelefono', etiqueta: 'Teléfono del pastor' },
      { id: 'iglesiaDireccion', etiqueta: 'Dirección de la iglesia' },
    ],
  },
  {
    grupo: 'Personas',
    campos: [
      { id: 'crearPersonas', etiqueta: 'Crear al coordinador y a quien envía si no existen' },
      { id: 'coordinadorCasilla', etiqueta: 'Poner al coordinador en su casilla' },
      { id: 'telefonoEnviador', etiqueta: 'Teléfono de quien envía en su ficha' },
      { id: 'telefonoCoordinador', etiqueta: 'Teléfono del coordinador (si no tiene)' },
      { id: 'moverProvisional', etiqueta: 'Pasar de "Provisional" a su destacamento' },
    ],
  },
];

export const TODOS_LOS_CAMPOS = GRUPOS_DE_CAMPOS.flatMap((g) => g.campos.map((c) => c.id));

/** Los campos pedidos, sin inventados. Sin lista (la carga de siempre), todos. */
export const camposElegidos = (lista) =>
  new Set(
    Array.isArray(lista) ? lista.filter((id) => TODOS_LOS_CAMPOS.includes(id)) : TODOS_LOS_CAMPOS
  );

const texto = (valor) => String(valor ?? '').trim();
const digitos = (valor) => {
  const d = String(valor ?? '').replace(/\D/g, '');
  return d.length === 11 && d.startsWith('1') ? d.slice(1) : d;
};

// "17:00" del envío y "17:00:00" del padrón son la misma hora.
const mismaHora = (a, b) => texto(a).slice(0, 5) === texto(b).slice(0, 5);

/**
 * El destacamento tras aplicar SOLO los campos elegidos. `antes` tiene la forma
 * de `mapApiDestToUI`; `direccion` ya viene armada en texto.
 */
export function destacamentoConCampos({ antes, datos = {}, direccion = '', campos }) {
  const usar = (id) => campos.has(id);
  const telefonoPastor = digitos(datos.pastor?.telefono);
  return {
    ...antes,
    name: usar('destNombre') && texto(datos.nombre) ? texto(datos.nombre) : antes.name,
    destNumber: usar('destNumero') && texto(datos.numero) ? texto(datos.numero) : antes.destNumber,
    direccion: usar('destDireccion') && direccion ? direccion : antes.direccion,
    registradoOfnc:
      usar('destRegistradoOfnc') && datos.registradoOfnc != null
        ? datos.registradoOfnc
        : antes.registradoOfnc,
    rritrackActivo:
      usar('destRritrack') && datos.rritrackActivo != null
        ? datos.rritrackActivo
        : antes.rritrackActivo,
    destMeetingDays:
      usar('destDia') && texto(datos.diaReunion) ? texto(datos.diaReunion) : antes.destMeetingDays,
    destMeetingTimes:
      usar('destHora') &&
      texto(datos.horaReunion) &&
      !mismaHora(datos.horaReunion, antes.destMeetingTimes)
        ? texto(datos.horaReunion)
        : antes.destMeetingTimes,
    // Solo llena el hueco: un teléfono que el destacamento ya tenga no se pisa.
    telefono:
      usar('destTelefono') && !digitos(antes.telefono) && telefonoPastor.length === 10
        ? `+1${telefonoPastor}`
        : antes.telefono,
  };
}

const ETIQUETAS_DESTACAMENTO = {
  name: 'Nombre',
  destNumber: 'Número',
  direccion: 'Dirección',
  registradoOfnc: 'Registrado en Oficina Nacional',
  rritrackActivo: 'RRITrack',
  destMeetingDays: 'Día de reunión',
  destMeetingTimes: 'Hora de reunión',
  telefono: 'Teléfono',
};

const legible = (valor) => (valor === true ? 'Sí' : valor === false ? 'No' : texto(valor) || '—');

/** Lo que de verdad cambia en el destacamento: [{ campo, etiqueta, antes, despues }]. */
export function diferenciasDeDestacamento(antes, despues) {
  return Object.keys(ETIQUETAS_DESTACAMENTO)
    .filter((campo) =>
      campo === 'telefono'
        ? digitos(antes[campo]) !== digitos(despues[campo])
        : campo === 'destMeetingTimes'
          ? !mismaHora(antes[campo], despues[campo])
          : legible(antes[campo]) !== legible(despues[campo])
    )
    .map((campo) => ({
      campo,
      etiqueta: ETIQUETAS_DESTACAMENTO[campo],
      antes: legible(antes[campo]),
      despues: legible(despues[campo]),
    }));
}
