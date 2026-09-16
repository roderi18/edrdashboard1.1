// ----------------------------------------------------------------------
// LO QUE LE ESCRIBEN A UN BUZON Y NADIE CONTESTA.
//
// Un buzon compartido (Tienda Virtual, Oficina Nacional) es un PODER, no una
// persona: quien lo atiende puede estar en otra pantalla, y si son varios cada
// uno puede dar por hecho que contesta el otro. Un mensaje se quedaba ahi sin
// respuesta sin que nadie se enterara, porque el unico rastro era el contador de
// la bandeja —y ese numero solo lo ve quien entra a mirarlo—.
//
// A LA HORA va un aviso de campana a quien ejerce el cargo del buzon y al
// Administrador Global. Si a las 24 HORAS sigue sin contestar, va un segundo
// aviso, con una señal de advertencia al final del texto para que se distinga
// del primero de un vistazo.
//
// EL RELOJ EMPIEZA EN EL PRIMER MENSAJE SIN CONTESTAR, NO EN EL ULTIMO. Contando
// desde el ultimo, alguien que insiste cada media hora retrasaria el aviso para
// siempre, que es justo cuando mas falta hace. Eso es `sinResponderDesde`: se
// pone cuando llega el primero y se borra cuando el buzon contesta. Las
// conversaciones anteriores a este campo se apañan con la fecha del ultimo
// mensaje, que es lo unico que tienen.
//
// Aqui solo esta la DECISION, sin Firestore ni avisos, para poder probarla con
// relojes de mentira. Quien la usa es `src/app/api/chat/route.js`.
// ----------------------------------------------------------------------

export const ESPERA_PRIMER_AVISO_MS = 60 * 60_000;
export const ESPERA_SEGUNDO_AVISO_MS = 24 * 60 * 60_000;

export const AVISO_PRIMERO = 'primero';
export const AVISO_SEGUNDO = 'segundo';

/** La señal que cierra el segundo aviso. */
export const SENAL_DE_ADVERTENCIA = '⚠️';

const enMilisegundos = (valor) => {
  const instante = Date.parse(String(valor ?? ''));

  return Number.isFinite(instante) ? instante : null;
};

/**
 * Que hay que avisar de esta conversacion: `'primero'`, `'segundo'` o nada.
 *
 * Pasadas las 24 horas devuelve SOLO el segundo aviso, aunque el primero nunca
 * llegara a salir: los avisos se calculan cuando alguien tiene la aplicacion
 * abierta, y soltar los dos de golpe seria ruido para decir una sola cosa.
 */
export function avisoPendienteDeBuzon({ conversacion = {}, idMiembrosBuzon, ahora = Date.now() }) {
  if (conversacion.eliminada === true) return null;

  const ultimoMensaje = conversacion.ultimoMensaje;

  if (!ultimoMensaje?.idMensaje) return null;

  // Contestar es lo unico que para el reloj. Leer no: el aviso existe
  // precisamente para lo que se leyo y se dejo para luego.
  if (Number(ultimoMensaje.remitenteIdMiembros) === Number(idMiembrosBuzon)) return null;

  const desde =
    enMilisegundos(conversacion.sinResponderDesde) ?? enMilisegundos(ultimoMensaje.enviadoEn);

  if (desde === null) return null;

  const espera = ahora - desde;

  if (espera >= ESPERA_SEGUNDO_AVISO_MS) return AVISO_SEGUNDO;
  if (espera >= ESPERA_PRIMER_AVISO_MS) return AVISO_PRIMERO;

  return null;
}

/**
 * Como queda el reloj de la conversacion despues de un mensaje.
 *
 * Devuelve `null` cuando no hay nada que apuntar —la conversacion no es de un
 * buzon, o el reloj ya corria— y un objeto para mezclar en el documento cuando
 * si lo hay.
 */
export function relojSinResponder({
  participantesIds = [],
  sinResponderDesde = '',
  remitenteIdMiembros,
  enviadoEn,
  esBuzon,
}) {
  if (!participantesIds.some((idMiembros) => esBuzon(idMiembros))) return null;

  // Contesto el buzon: el reloj se para. Se guarda vacio en vez de borrar el
  // campo para que `merge` lo pise —un `undefined` lo dejaria como estaba—.
  if (esBuzon(remitenteIdMiembros)) return { sinResponderDesde: '' };

  // Ya corria: el segundo mensaje de alguien que insiste no lo reinicia.
  if (sinResponderDesde) return null;

  return { sinResponderDesde: enviadoEn };
}

/** El texto del aviso. El segundo termina en la señal de advertencia. */
export function textoDeAvisoSinResponder({ buzon, paso, nombreDeQuienEscribio }) {
  const quien = String(nombreDeQuienEscribio ?? '').trim() || 'Alguien';

  return paso === AVISO_SEGUNDO
    ? `${quien} lleva más de 24 horas esperando respuesta de ${buzon.nombre}. ${SENAL_DE_ADVERTENCIA}`
    : `${quien} escribió a ${buzon.nombre} hace más de una hora y nadie ha respondido.`;
}

/** Un identificador por conversacion, paso y destinatario: el aviso se escribe una sola vez. */
export const idDeAvisoSinResponder = ({ buzon, idConversacion, paso, uid }) =>
  `buzon_sin_responder_${buzon.clave}_${idConversacion}_${paso}_${uid}`;
