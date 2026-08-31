import { v4 as uuidv4 } from 'uuid';

import { createConversation } from 'src/actions/chat';
import { recordarFelicitacionesEnviadas } from 'src/services/notification-service';
import {
  elegirFelicitacion,
  redactarFelicitacion,
} from 'src/catalogs/felicitaciones-cumpleanos.mjs';

// ----------------------------------------------------------------------
// "Enviar mensaje de felicitaciones".
//
// Quien pulsa no escribe nada: se elige un mensaje al azar de la lista y se
// manda POR EL CHAT, de su parte al cumpleañero. Queda una conversacion de
// verdad, y el cumpleañero puede responder.
//
// La memoria de lo ya enviado vive en la propia notificacion —una sola por
// cumpleaños, compartida por todos los que la reciben—, asi que si quince
// personas felicitan a la misma persona, le llegan quince mensajes DISTINTOS.
// Cuando la lista se agota, vuelve a empezar.
// ----------------------------------------------------------------------

const texto = (valor) => String(valor ?? '').trim();

const nombreDelCumpleanero = (notificacion = {}) => {
  const { nombres, apellidos } = notificacion?.metadatos ?? {};

  return [texto(nombres), texto(apellidos)].filter(Boolean).join(' ');
};

/** El primer nombre basta: es un mensaje, no un oficio. */
const nombreCorto = (completo = '') => texto(completo).split(/\s+/)[0] ?? '';

export const esNotificacionDeCumpleanos = (notificacion = {}) =>
  String(notificacion?.tipoNotificacion ?? '').startsWith('cumpleanos_');

/**
 * Manda la felicitacion. Devuelve, AL INSTANTE, el mensaje que va a salir.
 *
 * Elegir el mensaje no cuesta nada: es una lista en memoria. Lo que tardaba era
 * el viaje al servidor —crear la conversacion, escribir el mensaje, apuntar cual
 * se uso—, y quien pulsaba se quedaba mirando el boton hasta que todo eso
 * terminaba. No hace falta: el mensaje ya esta elegido desde el primer momento.
 *
 * Asi que se devuelve enseguida, con la entrega en marcha por detras. Lo que se
 * comprueba antes de devolver es lo que decide SI se puede enviar —que haya
 * cumpleañero, que haya quien felicita, que no sea uno mismo—; eso no toca la
 * red y se sabe al momento.
 *
 * `entrega` es la promesa del envio de verdad. Quien llama DEBE escucharla: si
 * falla, el mensaje no salio, y hay que decirlo aunque ya se haya dado por
 * enviado.
 */
export function enviarFelicitacionDeCumpleanos({ notificacion = {}, usuario = {} } = {}) {
  const idCumpleanero = texto(notificacion?.metadatos?.idMiembro);
  const idQuienFelicita = texto(usuario?.idMiembros ?? usuario?.memberId);

  if (!idCumpleanero) {
    throw new Error('Esta notificación no dice de quién es el cumpleaños.');
  }

  if (!idQuienFelicita) {
    throw new Error('No se pudo identificar tu cuenta para enviar el mensaje.');
  }

  if (idCumpleanero === idQuienFelicita) {
    throw new Error('Es tu propio cumpleaños: felicidades.');
  }

  const usados = Array.isArray(notificacion?.metadatos?.felicitacionesUsadas)
    ? notificacion.metadatos.felicitacionesUsadas
    : [];
  const elegida = elegirFelicitacion({ usados });
  const cuerpo = redactarFelicitacion(elegida.texto, nombreCorto(nombreDelCumpleanero(notificacion)));

  const mensaje = {
    id: uuidv4(),
    attachments: [],
    body: cuerpo,
    contentType: 'text',
    createdAt: new Date().toISOString(),
    senderId: idQuienFelicita,
    mentionIds: [],
    replyTo: null,
  };

  const entregar = async () => {
    // Sin `id`: para una conversacion de dos, el servidor lo arma con los dos
    // participantes (`individual_<a>_<b>`) y REUTILIZA la que ya exista, anadiendo
    // el mensaje. Pasarle uno inventado crearia una conversacion paralela.
    await createConversation({
      messages: [mensaje],
      participants: [{ idMiembros: idCumpleanero }, { idMiembros: idQuienFelicita }],
      type: 'ONE_TO_ONE',
      groupName: null,
      unreadCount: 0,
    });

    // La memoria de lo enviado va DESPUES: si el chat falla, el mensaje sigue
    // disponible para el siguiente en vez de quemarse sin haber salido. Y si lo
    // que falla es recordarlo, el mensaje ya salio: como mucho, el proximo podria
    // repetirse.
    if (notificacion?.id) {
      await recordarFelicitacionesEnviadas(notificacion.id, elegida.usados).catch((error) => {
        console.warn('[felicitaciones] no se pudo recordar el mensaje enviado', error);
      });
    }
  };

  const entrega = entregar();

  // Un oyente vacio para que, si quien llama tarda en escuchar, el navegador no
  // avise de una promesa sin manejar. No se traga nada: `entrega` sigue
  // rechazando para quien la escuche de verdad.
  entrega.catch(() => {});

  return { id: elegida.id, texto: cuerpo, entrega };
}
