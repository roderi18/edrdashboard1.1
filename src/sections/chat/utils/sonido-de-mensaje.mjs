// ----------------------------------------------------------------------
// ¿SUENA ESTE MENSAJE?
//
// UN SONIDO POR MENSAJE, NO UNO POR ESCUCHA. Las conversaciones se escuchan
// desde varios sitios a la vez —el marco del panel para la bolita, la pantalla
// del chat para la conversacion abierta, y los buzones compartidos desde
// cualquier pantalla—, asi que un mismo mensaje pasaba por aqui dos y tres
// veces. Y dentro de cada escucha, una conversacion cambia por muchas cosas que
// no son un mensaje nuevo (el acuse de entrega, el contador de no leidos).
//
// La memoria de cual fue el ultimo mensaje que sono en cada conversacion vive
// AQUI, en el modulo, para que todas las escuchas compartan la misma: la
// primera que ve el mensaje lo hace sonar, y las demas ya lo encuentran sonado.
//
// LA PRIMERA FOTO NO SUENA. Al suscribirse, Firestore entrega la lista entera
// como si fuera nueva; si eso sonara, entrar a una pantalla —o volver del
// chat— soltaria una campanada por conversacion. Se apunta lo que ya habia y se
// calla. Lo que aparezca DESPUES si suena, aunque sea una conversacion que no se
// habia visto nunca: es justo el caso de alguien que te escribe por primera vez,
// que antes se perdia.
// ----------------------------------------------------------------------

const ultimoMensajeQueSono = new Map();

/** Para los tests: olvida lo apuntado y deja el modulo como recien cargado. */
export const olvidarMensajesQueSonaron = () => ultimoMensajeQueSono.clear();

/**
 * @param conversacion  El documento de la conversacion, con `idConversacion`.
 * @param idMiembros    Quien escucha: la persona, o el buzon que atiende.
 * @param primeraFoto   `true` en el primer `onSnapshot` de esa escucha.
 */
export function debeSonarPorMensajeNuevo(conversacion, idMiembros, { primeraFoto = false } = {}) {
  const idConversacion = String(conversacion?.idConversacion ?? '');
  const idMensaje = String(conversacion?.ultimoMensaje?.idMensaje ?? '');

  if (!idConversacion || !idMensaje) return false;

  const yaSonado = ultimoMensajeQueSono.get(idConversacion);

  ultimoMensajeQueSono.set(idConversacion, idMensaje);

  if (yaSonado === idMensaje || primeraFoto) return false;

  const esDeOtro = Number(conversacion.ultimoMensaje?.remitenteIdMiembros) !== Number(idMiembros);
  const sinLeer = Number(conversacion.noLeidosPorIdMiembros?.[String(idMiembros)] ?? 0) > 0;
  // SILENCIAR LA CONVERSACION SILENCIA SU SONIDO. Es lo que la gente espera del
  // boton "Silenciar notificaciones" del chat: sin esto seguia sonando igual.
  const silenciada = Boolean(conversacion.silenciadoPorIdMiembros?.[String(idMiembros)]);

  return esDeOtro && sinLeer && !silenciada;
}
