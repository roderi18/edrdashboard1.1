// ----------------------------------------------------------------------
// TIENDA VIRTUAL: EL BUZON COMPARTIDO DE LA TIENDA EN EL CHAT.
//
// "Tienda Virtual" no es la cuenta de nadie. Es un PODER: quien ejerce el cargo
// de Administrador de Gestion de Tienda o de Administrador Global ve lo que la
// gente le escribe a la tienda y contesta en su nombre. Si manana el cargo pasa
// a otra persona, el buzon pasa con el; no hay que traspasar ninguna cuenta.
//
// POR QUE UN NUMERO Y NO EL TEXTO "TIENDA". Todo el chat identifica a cada
// participante por su `idMiembros`, que es un entero: las reglas de Firestore
// piden `idMiembros is int` y el codigo compara numeros en decenas de sitios.
//
// POR QUE 20001. Antes era `-900001`, un numero que no decia nada y que ademas
// los normalizadores del chat —solo positivos— tiraban a la basura: la Tienda se
// caia de sus propias conversaciones. 20001 casa con su codigo `EDR-20001` y con
// la serie de los codigos de miembro (`EDR-10001`, ...), asi que en cualquier
// listado se reconoce a simple vista.
//
// EL RIESGO DE UN POSITIVO: que un miembro real llegue a tener ese numero. Hoy el
// padron va por los cientos, pero no se deja al azar: `esIdReservadoDeTienda`
// impide que una SESION de persona se identifique con el, aqui y en las reglas.
//
// NADIE escribe el numero a mano: se usa `ID_TIENDA_VIRTUAL` y `esTiendaVirtual`.
// Es `.mjs` y sin dependencias para que lo importen igual el servidor, el
// navegador y los tests.
// ----------------------------------------------------------------------

export const ID_TIENDA_VIRTUAL = 20001;

// El id que tuvo hasta la migracion. Solo lo usa el script que mueve las
// conversaciones y los avisos viejos; la aplicacion ya no lo reconoce.
export const ID_TIENDA_VIRTUAL_ANTERIOR = -900001;

// La identidad de Firebase con la que el SERVIDOR escribe como Tienda. Solo el
// servidor puede emitir su token —hace falta la cuenta de servicio—, asi que
// ningun navegador puede hacerse pasar por ella.
export const UID_TIENDA_VIRTUAL = 'tienda-virtual';

export const CODIGO_TIENDA_VIRTUAL = 'EDR-20001';

export const NOMBRE_TIENDA_VIRTUAL = 'Tienda Virtual';

export const AVATAR_TIENDA_VIRTUAL = '/logo/logo-single.png';

// Los dos cargos que atienden el buzon. Codigos del catalogo de `roles.js`.
export const CARGOS_DEL_BUZON_DE_TIENDA = Object.freeze([
  'administrador_tienda',
  'administrador_global',
]);

export const esTiendaVirtual = (idMiembros) =>
  idMiembros !== null &&
  idMiembros !== undefined &&
  idMiembros !== '' &&
  Number(idMiembros) === ID_TIENDA_VIRTUAL;

/**
 * ¿Se esta intentando INICIAR SESION con el numero de la Tienda?
 *
 * Una persona nunca es la Tienda. Si el padron llegara a darle a alguien el
 * 20001, esa sesion se rechaza en vez de heredar el buzon de toda la tienda.
 */
export const esIdReservadoDeTienda = esTiendaVirtual;

/**
 * El id de un PARTICIPANTE del chat: un entero positivo, que puede ser un miembro
 * o la Tienda Virtual.
 */
export const idDeParticipanteChat = (value) => {
  const parsed = Number(value);

  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};

/** Como la ve el resto del chat: un contacto mas, con su nombre y su cara. */
export const contactoTiendaVirtual = () => ({
  id: String(ID_TIENDA_VIRTUAL),
  idMiembros: ID_TIENDA_VIRTUAL,
  codigoMiembro: CODIGO_TIENDA_VIRTUAL,
  nombres: 'Tienda',
  apellidos: 'Virtual',
  name: NOMBRE_TIENDA_VIRTUAL,
  avatarUrl: AVATAR_TIENDA_VIRTUAL,
  status: 'online',
  esTiendaVirtual: true,
});

/** Como se guarda dentro de `participantes` de una conversacion. */
export const participanteTiendaVirtual = () => ({
  idMiembros: ID_TIENDA_VIRTUAL,
  codigoMiembro: CODIGO_TIENDA_VIRTUAL,
  nombres: 'Tienda',
  apellidos: 'Virtual',
  correo: '',
  telefono: '',
  estatusMiembro: 'sistema',
  avatarUrl: AVATAR_TIENDA_VIRTUAL,
});

/** El id de la conversacion de un miembro con la Tienda, igual que las demas. */
export const idConversacionConTienda = (idMiembros) =>
  `individual_${[Number(idMiembros), ID_TIENDA_VIRTUAL].sort((a, b) => a - b).join('_')}`;

// ----------------------------------------------------------------------
// QUIEN PUEDE ATENDER EL BUZON.
// ----------------------------------------------------------------------

const texto = (value) =>
  String(value ?? '')
    .trim()
    .toLowerCase();

// De que colecciones se FIA el servidor. `users/<uid>` NO: ese documento se lo
// escribe el propio navegador, y cualquiera se pondria ahi `rol: 'administrador'`.
// `usuarios_roles` y `admins` solo los escribe el Admin SDK.
const COLECCIONES_DE_CONFIANZA = new Set(['usuarios_roles', 'admins']);

const codigosDelPerfil = (perfil = {}) => {
  const codigos = [
    perfil.rolId,
    perfil.rol,
    perfil.role,
    ...(Array.isArray(perfil.cargos) ? perfil.cargos : []).map(
      (cargo) => cargo?.rol ?? cargo?.rolId ?? cargo?.codigo
    ),
  ].map(texto);

  // Las cuentas de antes del catalogo de cargos: un administrador pleno se
  // marcaba `rol: 'administrador'` y nada mas. Las reglas de Firestore ya lo
  // cuentan como Administrador Global (`rolHeredadoDelDocumento`); aqui igual,
  // o esas cuentas verian el buzon en las reglas y no en la aplicacion.
  if (codigos.includes('administrador') || perfil.collection === 'admins') {
    codigos.push('administrador_global');
  }

  return codigos.filter(Boolean);
};

/**
 * ¿Esta sesion atiende el buzon de la Tienda?
 *
 * Se pregunta por TODOS los cargos que ejerce —el rol principal, los de su
 * directiva y el claim del token—, no solo por el principal: quien es
 * Administrador de Tienda y ademas ocupa otra casilla entra con la otra, y
 * mirar solo esa le quitaba el buzon.
 */
export const puedeAtenderBuzonDeTienda = ({ claims = {}, perfiles = [] } = {}) => {
  const codigos = [
    texto(claims?.rol),
    ...(Array.isArray(perfiles) ? perfiles : [])
      .filter((perfil) => perfil && COLECCIONES_DE_CONFIANZA.has(perfil.collection))
      .flatMap(codigosDelPerfil),
  ];

  return codigos.some((codigo) => CARGOS_DEL_BUZON_DE_TIENDA.includes(codigo));
};
