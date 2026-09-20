// ----------------------------------------------------------------------
// LA CUENTA "SISTEMA" DEL CHAT.
//
// Un canal para AVISAR, no para conversar: por aqui llegan los cumpleaños del
// destacamento (y lo que venga despues). Se parece a los buzones compartidos
// (`chat-buzones.mjs`) en que no es la cuenta de ninguna persona, pero es lo
// contrario en lo demas: un buzon lo atiende alguien y contesta; a Sistema no lo
// atiende nadie y NADIE le contesta. Solo escribe el servidor, con el Admin SDK.
//
// Por eso no es una entrada mas de `BUZONES_COMPARTIDOS`: meterlo ahi le daria
// bandeja, token de servidor para "responder como" y cargos que lo atienden, que
// es justo lo que no debe tener.
//
// El numero sigue la serie de los buzones (20001 Tienda, 20002 Oficina): nadie
// puede iniciar sesion con el (`esIdReservadoDeBuzon` lo cuenta) y las reglas le
// niegan cualquier escritura desde el navegador.
//
// Sin dependencias: lo importan igual el servidor, el navegador y los tests.
// ----------------------------------------------------------------------

export const CUENTA_SISTEMA = Object.freeze({
  idMiembros: 20003,
  codigo: 'EDR-20003',
  nombre: 'Sistema',
  nombres: 'Sistema',
  apellidos: '',
  avatarPorDefecto: '/logo/logo-single.png',
});

// Donde queda constancia de cada envio: dia, hora, cuantos mensajes, a que
// destacamento, a quienes y por que. Lo lee el Administrador Global en
// Administracion → Notificaciones → "Chat Sistema"; lo escribe solo el servidor.
export const COLECCION_REGISTRO_CHAT_SISTEMA = 'chat_sistema_registro';

// El error que devuelve el servidor si alguien intenta escribirle.
export const CODIGO_CHAT_SOLO_LECTURA = 'CHAT_SISTEMA_SOLO_LECTURA';
export const AVISO_CHAT_SOLO_LECTURA =
  'Este es un canal informativo del Sistema. No se pueden enviar respuestas.';

const numero = (valor) =>
  valor === null || valor === undefined || valor === '' ? NaN : Number(valor);

export const esCuentaSistema = (idMiembros) => numero(idMiembros) === CUENTA_SISTEMA.idMiembros;

/**
 * ¿Es de Sistema este id de conversacion (`individual_367_20003`)? Se sabe desde
 * la direccion, antes de que lleguen los participantes: mirando solo a estos, la
 * caja de escribir asomaba mientras cargaba la conversacion.
 */
export const esIdConversacionDeSistema = (idConversacion) => {
  const id = String(idConversacion ?? '');

  return id.startsWith('individual_') && id.split('_').slice(1).some(esCuentaSistema);
};

/** ¿Esta conversacion es la de Sistema? Mira su id, los ids guardados o los de la pantalla. */
export const esConversacionDeSistema = (conversacion = {}) => {
  const id = String(conversacion?.idConversacion ?? conversacion?.id ?? '');
  const tipo = String(conversacion?.tipoConversacion ?? '').trim().toUpperCase();
  const participantesIds = Array.isArray(conversacion?.participantesIds)
    ? conversacion.participantesIds
    : [];
  const participantes = Array.isArray(conversacion?.participants)
    ? conversacion.participants
    : Array.isArray(conversacion?.participantes)
      ? conversacion.participantes
      : [];

  // Los grupos de administradores pueden incluir mensajes informativos enviados
  // por Sistema, pero siguen siendo conversaciones entre personas. Solo se
  // bloquean los chats individuales con la cuenta Sistema.
  if (
    tipo === 'GRUPAL' ||
    id.startsWith('grupo_') ||
    id.startsWith('grupal_') ||
    participantesIds.length > 2 ||
    participantes.length > 2
  ) {
    return false;
  }

  if (esIdConversacionDeSistema(id)) return true;

  const ids = participantesIds.length
    ? participantesIds
    : participantes.map((participante) => participante?.idMiembros ?? participante?.id);

  return ids.length === 2 && ids.some(esCuentaSistema);
};

/** El id de la conversacion de un miembro con Sistema, igual que las demas individuales. */
export const idConversacionConSistema = (idMiembros) =>
  `individual_${[Number(idMiembros), CUENTA_SISTEMA.idMiembros].sort((a, b) => a - b).join('_')}`;

/** Como se guarda dentro de `participantes` de una conversacion. */
export const participanteSistema = () => ({
  idMiembros: CUENTA_SISTEMA.idMiembros,
  codigoMiembro: CUENTA_SISTEMA.codigo,
  nombres: CUENTA_SISTEMA.nombres,
  apellidos: CUENTA_SISTEMA.apellidos,
  correo: '',
  telefono: '',
  estatusMiembro: 'sistema',
  avatarUrl: CUENTA_SISTEMA.avatarPorDefecto,
});

/** "Hoy", "Mañana", "En 7 días": lo mismo en el texto del mensaje y en su tarjeta. */
export const cuandoCumple = (dias) => {
  if (dias === 0) return 'Hoy';
  if (dias === 1) return 'Mañana';

  return `En ${dias} días`;
};

/**
 * "Randy Samuel Cruz Martinez está de cumpleaños hoy 🎊". Una frase por persona,
 * sin encabezado: con "🎂 Cumpleaños en tu destacamento" delante, el mensaje
 * decia dos veces lo mismo y el nombre quedaba en segundo plano.
 */
export const fraseDeCumpleanos = (nombre, dias) => {
  if (dias === 0) return `${nombre} está de cumpleaños hoy 🎊`;
  if (dias === 1) return `${nombre} está de cumpleaños mañana 🎉`;

  return `${nombre} está de cumpleaños en ${dias} días 🎂`;
};

/** Como lo ve el resto del chat: un contacto con su nombre y su cara. */
export const contactoSistema = () => ({
  id: String(CUENTA_SISTEMA.idMiembros),
  idMiembros: CUENTA_SISTEMA.idMiembros,
  codigoMiembro: CUENTA_SISTEMA.codigo,
  nombres: CUENTA_SISTEMA.nombres,
  apellidos: CUENTA_SISTEMA.apellidos,
  name: CUENTA_SISTEMA.nombre,
  avatarUrl: CUENTA_SISTEMA.avatarPorDefecto,
  status: 'online',
  esSistema: true,
});
