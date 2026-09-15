import {
  BUZON_TIENDA,
  contactoDeBuzon,
  puedeAtenderBuzon,
  participanteDeBuzon,
  esIdReservadoDeBuzon,
  idConversacionConBuzon,
} from './chat-buzones.mjs';

// ----------------------------------------------------------------------
// TIENDA VIRTUAL: EL PRIMER BUZON COMPARTIDO DEL CHAT.
//
// La definicion vive ahora en `chat-buzones.mjs`, junto a la de Oficina
// Nacional: un buzon es una entrada de esa lista. Este archivo se queda con los
// nombres de siempre —`ID_TIENDA_VIRTUAL`, `esTiendaVirtual`...— porque los usan
// los pedidos, la tienda y los tests, y todos siguen significando lo mismo.
//
// POR QUE 20001 Y NO -900001. Los normalizadores del chat solo aceptan
// positivos: con el negativo, la Tienda se caia de sus propias conversaciones.
// ----------------------------------------------------------------------

export const ID_TIENDA_VIRTUAL = BUZON_TIENDA.idMiembros;

// El id que tuvo hasta la migracion. Solo lo usa el script que mueve las
// conversaciones y los avisos viejos; la aplicacion ya no lo reconoce.
export const ID_TIENDA_VIRTUAL_ANTERIOR = -900001;

export const UID_TIENDA_VIRTUAL = BUZON_TIENDA.uid;

export const CODIGO_TIENDA_VIRTUAL = BUZON_TIENDA.codigo;

export const NOMBRE_TIENDA_VIRTUAL = BUZON_TIENDA.nombre;

export const AVATAR_TIENDA_VIRTUAL = BUZON_TIENDA.avatarPorDefecto;

export const CARGOS_DEL_BUZON_DE_TIENDA = BUZON_TIENDA.cargos;

export const esTiendaVirtual = (idMiembros) =>
  idMiembros !== null &&
  idMiembros !== undefined &&
  idMiembros !== '' &&
  Number(idMiembros) === ID_TIENDA_VIRTUAL;

/**
 * ¿Se esta intentando INICIAR SESION con un numero reservado?
 *
 * Ya no solo el de la Tienda: ninguna persona puede usar el numero de NINGUN
 * buzon compartido. Se conserva el nombre porque es el que usa el servidor.
 */
export const esIdReservadoDeTienda = esIdReservadoDeBuzon;

/**
 * El id de un PARTICIPANTE del chat: un entero positivo, que puede ser un miembro
 * o un buzon compartido.
 */
export const idDeParticipanteChat = (value) => {
  const parsed = Number(value);

  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};

/** Como la ve el resto del chat: un contacto mas, con su nombre y su cara. */
export const contactoTiendaVirtual = (avatarUrl = '') => contactoDeBuzon(BUZON_TIENDA, avatarUrl);

/** Como se guarda dentro de `participantes` de una conversacion. */
export const participanteTiendaVirtual = (avatarUrl = '') =>
  participanteDeBuzon(BUZON_TIENDA, avatarUrl);

/** El id de la conversacion de un miembro con la Tienda, igual que las demas. */
export const idConversacionConTienda = (idMiembros) =>
  idConversacionConBuzon(BUZON_TIENDA, idMiembros);

/** ¿Esta sesion atiende el buzon de la Tienda? Ver `puedeAtenderBuzon`. */
export const puedeAtenderBuzonDeTienda = (datos = {}) => puedeAtenderBuzon(BUZON_TIENDA, datos);
