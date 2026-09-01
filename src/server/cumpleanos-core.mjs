// ----------------------------------------------------------------------
// LOS CUMPLEANOS DEL DIA.
//
// Quien cumple hoy y quien cumple dentro de una semana, y como se redacta el
// aviso. Puro y sin dependencias: lo usa la funcion programada que corre una vez
// al dia, y se puede probar sin Firebase ni red.
//
// El aviso va a TODOS los miembros del destacamento del cumpleanero: no es un
// dato reservado y es justo la gente que lo felicita.
// ----------------------------------------------------------------------

export const DIAS_DE_AVISO = [0, 7];

export const COLECCION_NOTIFICACIONES = 'notificaciones';
export const COLECCION_PREFERENCIAS = 'preferencias_notificaciones';

const texto = (valor) => String(valor ?? '').trim();

export const fechaDeNacimiento = (miembro = {}) =>
  miembro?.fechaNacimiento ?? miembro?.birthDate ?? miembro?.dateOfBirth ?? miembro?.birth ?? null;

/**
 * La fecha, leida en la zona horaria de aqui.
 *
 * `new Date('2009-08-31')` se interpreta como medianoche UTC, que en Santo
 * Domingo —UTC-4— es el DIA ANTERIOR: el cumpleaños del 31 se leia como 30 y el
 * aviso salia un dia antes, todos los años y para todo el mundo. Un
 * 'YYYY-MM-DD' se parte a mano; lo demas se deja a `Date`, que ya resuelve bien
 * las fechas con hora.
 */
const fechaLocal = (valor) => {
  const iso = String(valor ?? '').trim().slice(0, 10);
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);

  if (partes) {
    return new Date(Number(partes[1]), Number(partes[2]) - 1, Number(partes[3]), 12);
  }

  const suelta = new Date(valor);

  return Number.isNaN(suelta.getTime()) ? null : suelta;
};

/**
 * Cuantos dias faltan para su proximo cumpleaños. `null` si no hay fecha.
 *
 * Se compara a mediodia y no a medianoche para que el cambio de horario de
 * verano no descuente un dia: una diferencia de 23 o 25 horas seguiria
 * redondeando al dia que toca.
 */
export const diasHastaCumpleanos = (valor, hoy = new Date()) => {
  if (!valor) return null;

  const nacimiento = fechaLocal(valor);

  if (!nacimiento) return null;

  const desde = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 12);
  let proximo = new Date(hoy.getFullYear(), nacimiento.getMonth(), nacimiento.getDate(), 12);

  if (proximo < desde) {
    proximo = new Date(hoy.getFullYear() + 1, nacimiento.getMonth(), nacimiento.getDate(), 12);
  }

  return Math.round((proximo.getTime() - desde.getTime()) / 86400000);
};

export const nombreDelMiembro = (miembro = {}) =>
  [
    texto(miembro?.nombres ?? miembro?.firstName),
    texto(miembro?.apellidos ?? miembro?.lastName),
  ]
    .filter(Boolean)
    .join(' ')
    .trim() ||
  texto(miembro?.codigoMiembro ?? miembro?.memberId) ||
  'un miembro';

export const idDelMiembro = (miembro = {}) => texto(miembro?.idMiembros ?? miembro?.id);

export const destacamentoDelMiembro = (miembro = {}) =>
  texto(miembro?.idDestacamento ?? miembro?.destId ?? miembro?.destamentoId);

/** Los que cumplen hoy o dentro de 7 dias, con los dias que faltan. */
export const cumpleanosDelDia = (miembros = [], { hoy = new Date(), diasAviso = DIAS_DE_AVISO } = {}) =>
  (Array.isArray(miembros) ? miembros : [])
    .map((miembro) => ({ miembro, dias: diasHastaCumpleanos(fechaDeNacimiento(miembro), hoy) }))
    .filter(({ dias }) => dias !== null && diasAviso.includes(dias));

/**
 * Los ids de acceso de quienes pertenecen a ese destacamento.
 *
 * `exceptoMiembro` deja fuera a alguien: al cumpleañero, que no tiene por que
 * enterarse por una notificacion de que hoy cumple años. Ademas el boton de
 * felicitar le rechazaria —no se felicita uno a si mismo—, asi que el aviso solo
 * le ocuparia sitio.
 */
export const destinatariosDelDestacamento = ({
  idDestacamento,
  miembros = [],
  cuentasPorMiembro = {},
  exceptoMiembro = null,
}) => {
  const destino = texto(idDestacamento);

  if (!destino) return [];

  const excluido = texto(exceptoMiembro);
  // Todas sus cuentas, no solo una: quien tiene dos no debe recibirlo por la otra.
  const cuentasExcluidas = new Set(excluido ? (cuentasPorMiembro[excluido] ?? []).map(texto) : []);

  return [
    ...new Set(
      (Array.isArray(miembros) ? miembros : [])
        .filter((miembro) => destacamentoDelMiembro(miembro) === destino)
        .filter((miembro) => !excluido || idDelMiembro(miembro) !== excluido)
        .flatMap((miembro) => cuentasPorMiembro[idDelMiembro(miembro)] ?? [])
        .filter(Boolean)
        .filter((idCuenta) => !cuentasExcluidas.has(texto(idCuenta)))
    ),
  ];
};

/** ¿Este usuario apago los cumpleaños en sus preferencias? */
export const aceptaElAviso = (preferencias = null, tipoNotificacion = '') => {
  if (!preferencias) return true;
  if (preferencias?.tiposNotificacion?.[tipoNotificacion] === false) return false;
  if (preferencias?.modulos?.cumpleanos === false) return false;

  return true;
};

/**
 * El documento del aviso, con la misma forma que crea la aplicacion.
 *
 * El id lleva la fecha dentro: si la tarea corre dos veces el mismo dia, la
 * segunda pisa a la primera en vez de duplicar el aviso.
 */
export const construirAvisoDeCumpleanos = ({
  miembro,
  dias,
  idsDestinatarios,
  hoy = new Date(),
  urlFoto = '',
  urlFotoMiniatura = '',
}) => {
  const esHoy = dias === 0;
  const tipoNotificacion = esHoy
    ? 'cumpleanos_miembro_destacamento_hoy'
    : 'cumpleanos_miembro_destacamento_7_dias';
  const nombre = nombreDelMiembro(miembro);
  const idMiembro = idDelMiembro(miembro);
  const clave = hoy.toISOString().slice(0, 10);
  const ahora = new Date().toISOString();
  const mensaje = esHoy
    ? `Hoy está de cumpleaños ${nombre}.`
    : `Faltan 7 días para el cumpleaños de ${nombre}.`;

  return {
    id: `${tipoNotificacion}_${idMiembro}_${clave}`,
    tipoNotificacion,
    modulo: 'cumpleanos',
    titulo: esHoy ? 'Cumpleaños hoy en tu destacamento' : 'Cumpleaños próximo en tu destacamento',
    tituloHtml: null,
    mensaje,
    mensajeVisual: mensaje,
    rolDestinatario: 'usuario',
    idsDestinatarios,
    prioridad: 'informativa',
    estado: 'no_leida',
    fechaCreacion: ahora,
    fechaEnvio: ahora,
    actorId: 'sistema',
    actorTipo: 'sistema',
    actorNombre: 'Cumpleaños',
    actorFotoURL: null,
    entidadTipo: 'miembro',
    entidadId: idMiembro,
    ruta: idMiembro ? `/dashboard/level/member/${idMiembro}/edit` : '/dashboard/level/member',
    imagenTipo: 'persona',
    // La cara del cumpleañero. NO viene en el padron de la API: las fotos viven
    // en Firebase, en `fotos`, y hay que traerlas aparte. Sin esto el aviso
    // salia con el icono generico de sobre, que es justo lo contrario de lo que
    // se quiere ver en un cumpleaños.
    imagenURL: texto(urlFoto) || miembro?.avatarUrl || miembro?.photoURL || null,
    // La chica para la lista de la campana, donde la cara mide 40px. Si no hay,
    // se queda la grande: mas vale pesada que ninguna.
    miniaturaURL:
      texto(urlFotoMiniatura) || texto(urlFoto) || miembro?.avatarUrl || miembro?.photoURL || null,
    tipoAccion: 'ver',
    etiquetaAccion: 'Ver perfil',
    tipoAccionSecundaria: null,
    etiquetaAccionSecundaria: null,
    leidaPor: [],
    fechaProgramada: null,
    fechaExpiracion: null,
    fechaLectura: null,
    metadatos: {
      idMiembro,
      nombres: texto(miembro?.nombres ?? miembro?.firstName),
      apellidos: texto(miembro?.apellidos ?? miembro?.lastName),
      diasHastaCumpleanos: dias,
      idDestacamento: destacamentoDelMiembro(miembro),
      fechaEjecucion: clave,
    },
  };
};
