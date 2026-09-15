// ----------------------------------------------------------------------
// BUZONES COMPARTIDOS DEL CHAT.
//
// "Tienda Virtual" fue el primero: una identidad del chat que no es la cuenta de
// nadie, sino un PODER. Quien ejerce uno de sus cargos ve lo que la gente le
// escribe y contesta en su nombre; si el cargo pasa a otra persona, el buzon
// pasa con el.
//
// Oficina Nacional necesitaba lo mismo, y copiar la Tienda habria dejado dos
// implementaciones que se separan con el tiempo. Asi que un buzon es ahora UNA
// ENTRADA DE ESTA LISTA: su numero, su identidad de Firebase, su nombre y los
// cargos que lo atienden. Todo lo demas —token del servidor, bandeja en la
// pantalla, avisos, reglas— se construye a partir de ella.
//
// POR QUE NUMEROS DE LA SERIE 20000. Todo el chat identifica a cada participante
// por su `idMiembros`, un entero positivo, y los codigos de miembro van por
// `EDR-10001`: `EDR-20001`, `EDR-20002` se reconocen a simple vista como
// cuentas de la organizacion y quedan lejos del padron, que va por los cientos.
// Aun asi no se deja al azar: `esIdReservadoDeBuzon` impide que una SESION de
// persona se identifique con uno de ellos, aqui y en las reglas.
//
// Es `.mjs` y sin dependencias para que lo importen igual el servidor, el
// navegador y los tests. NADIE escribe los numeros a mano.
//
// PARA AÑADIR OTRO BUZON: una entrada aqui, su identidad en `firestore.rules` y
// `storage.rules` (`idMiembroNoUsurpaUnBuzon`, `atiendeBuzonDe...`) y su
// coleccion de respuestas. El test `chat-buzones-compartidos` avisa si falta algo.
// ----------------------------------------------------------------------

export const BUZON_TIENDA = Object.freeze({
  clave: 'tienda',
  idMiembros: 20001,
  // La identidad de Firebase con la que el SERVIDOR escribe como el buzon. Solo
  // el servidor puede emitir su token —hace falta la cuenta de servicio—.
  uid: 'tienda-virtual',
  codigo: 'EDR-20001',
  nombre: 'Tienda Virtual',
  nombres: 'Tienda',
  apellidos: 'Virtual',
  avatarPorDefecto: '/logo/logo-single.png',
  // Codigos del catalogo de `roles.js`.
  cargos: Object.freeze(['administrador_tienda', 'administrador_global']),
  // Quien contesto de verdad, aparte del mensaje y solo para el servidor.
  coleccionRespuestas: 'respuestas_tienda',
  etiquetaBandeja: 'Chats de la Tienda',
  icono: 'solar:cart-3-bold',
  tituloAviso: 'Mensaje para la Tienda',
  fraseAviso: 'escribió a la Tienda Virtual',
});

export const BUZON_OFICINA_NACIONAL = Object.freeze({
  clave: 'oficina',
  idMiembros: 20002,
  uid: 'oficina-nacional',
  codigo: 'EDR-20002',
  nombre: 'Oficina Nacional',
  nombres: 'Oficina',
  apellidos: 'Nacional',
  avatarPorDefecto: '/logo/logo-single.png',
  // El Administrador Global atiende todos los buzones, igual que en la Tienda.
  cargos: Object.freeze(['oficina_nacional', 'administrador_global']),
  coleccionRespuestas: 'respuestas_oficina',
  etiquetaBandeja: 'Chats de Oficina Nacional',
  icono: 'solar:inbox-bold',
  tituloAviso: 'Mensaje para Oficina Nacional',
  fraseAviso: 'escribió a Oficina Nacional',
});

export const BUZONES_COMPARTIDOS = Object.freeze([BUZON_TIENDA, BUZON_OFICINA_NACIONAL]);

const numero = (valor) =>
  valor === null || valor === undefined || valor === '' ? NaN : Number(valor);

/** El buzon que usa ese `idMiembros`, o null si es una persona. */
export const buzonPorIdMiembros = (idMiembros) =>
  BUZONES_COMPARTIDOS.find((buzon) => buzon.idMiembros === numero(idMiembros)) ?? null;

/** El buzon de una bandeja de la pantalla (`?bandeja=oficina`), o null. */
export const buzonPorClave = (clave) =>
  BUZONES_COMPARTIDOS.find((buzon) => buzon.clave === String(clave ?? '').trim()) ?? null;

export const esBuzonCompartido = (idMiembros) => Boolean(buzonPorIdMiembros(idMiembros));

/**
 * ¿Se esta intentando INICIAR SESION con el numero de un buzon?
 *
 * Una persona nunca es un buzon. Si el padron llegara a darle a alguien uno de
 * estos numeros, esa sesion se rechaza en vez de heredar las conversaciones de
 * toda la tienda o de toda la Oficina.
 */
export const esIdReservadoDeBuzon = esBuzonCompartido;

export const esUidDeBuzon = (uid) =>
  BUZONES_COMPARTIDOS.some((buzon) => buzon.uid === String(uid ?? '').trim());

/** Como lo ve el resto del chat: un contacto mas, con su nombre y su cara. */
export const contactoDeBuzon = (buzon, avatarUrl = '') => ({
  id: String(buzon.idMiembros),
  idMiembros: buzon.idMiembros,
  codigoMiembro: buzon.codigo,
  nombres: buzon.nombres,
  apellidos: buzon.apellidos,
  name: buzon.nombre,
  avatarUrl: avatarUrl || buzon.avatarPorDefecto,
  status: 'online',
  esBuzonCompartido: true,
  buzon: buzon.clave,
  // Las pantallas de antes preguntan por esto.
  esTiendaVirtual: buzon.clave === BUZON_TIENDA.clave,
});

/** Como se guarda dentro de `participantes` de una conversacion. */
export const participanteDeBuzon = (buzon, avatarUrl = '') => ({
  idMiembros: buzon.idMiembros,
  codigoMiembro: buzon.codigo,
  nombres: buzon.nombres,
  apellidos: buzon.apellidos,
  correo: '',
  telefono: '',
  estatusMiembro: 'sistema',
  avatarUrl: avatarUrl || buzon.avatarPorDefecto,
});

/** El id de la conversacion de un miembro con un buzon, igual que las demas. */
export const idConversacionConBuzon = (buzon, idMiembros) =>
  `individual_${[Number(idMiembros), buzon.idMiembros].sort((a, b) => a - b).join('_')}`;

// ----------------------------------------------------------------------
// QUIEN PUEDE ATENDER UN BUZON (en el servidor).
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
 * ¿Esta sesion atiende ese buzon?
 *
 * Se pregunta por TODOS los cargos que ejerce —el rol principal, los de su
 * directiva y el claim del token—, no solo por el principal: quien ejerce el
 * cargo del buzon y ademas ocupa otra casilla entra con la otra, y mirar solo
 * esa le quitaba el buzon.
 */
const codigosDeLaSesion = ({ claims = {}, perfiles = [] } = {}) => [
  texto(claims?.rol),
  ...(Array.isArray(perfiles) ? perfiles : [])
    .filter((perfil) => perfil && COLECCIONES_DE_CONFIANZA.has(perfil.collection))
    .flatMap(codigosDelPerfil),
];

export const puedeAtenderBuzon = (buzon, datos = {}) =>
  Boolean(buzon) && codigosDeLaSesion(datos).some((codigo) => buzon.cargos.includes(codigo));

/**
 * ¿Quien atiende el buzon es Administrador Global? SOLO a el se le enseña, en
 * cada respuesta del buzon, quien contesto —nombre y usuario—: es quien responde
 * de lo que se dice en nombre de la organizacion. Al resto de quienes atienden
 * el buzon no se les dice: ven al buzon, igual que el miembro.
 */
export const ejerceAdministracionGlobal = (datos = {}) =>
  codigosDeLaSesion(datos).includes('administrador_global');

// ----------------------------------------------------------------------
// LA FOTO DEL BUZON.
//
// La cambia el Administrador Global desde el chat y la ve todo el mundo: en la
// lista de contactos, en las conversaciones y en los avisos. Vive en
// `buzones_chat/<clave>`; sin documento, la de siempre.
// ----------------------------------------------------------------------

export const COLECCION_BUZONES_CHAT = 'buzones_chat';

/** Solo una URL https o una ruta de la propia aplicacion; lo demas no se pinta. */
export const avatarDeBuzonValido = (valor) => {
  const url = String(valor ?? '').trim();

  // `//otro-sitio` tambien empieza por barra y el navegador lo lee como otra web.
  if (url.startsWith('/') && !url.startsWith('//')) return url;

  try {
    return new URL(url).protocol === 'https:' ? url : '';
  } catch {
    return '';
  }
};
