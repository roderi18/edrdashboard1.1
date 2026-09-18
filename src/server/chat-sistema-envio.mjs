import { createChatMessageDocument } from './chat-message-model.mjs';
import { cumpleanosDelDia, DIAS_DE_AVISO_CHAT } from './cumpleanos-core.mjs';
import {
  fechaClaveLocal,
  registroDelEnvio,
  repartoDelChatDeCumpleanos,
} from './chat-sistema-cumpleanos.mjs';
import {
  CUENTA_SISTEMA,
  participanteSistema,
  idConversacionConSistema,
  COLECCION_REGISTRO_CHAT_SISTEMA,
} from '../utils/chat-sistema.mjs';

// ----------------------------------------------------------------------
// SISTEMA ESCRIBE EN EL CHAT.
//
// Con el Admin SDK, que es lo unico que puede escribir como Sistema: las reglas
// se lo niegan a cualquier sesion. Recibe `db` y `FieldValue` desde fuera para
// que lo usen igual la funcion programada de Netlify y la prueba a mano, cada
// una con su propia conexion.
//
// Mismo formato que escribe la ruta del chat (`src/app/api/chat/route.js`): la
// conversacion individual de siempre, el mensaje por `createChatMessageDocument`
// y el no leido del receptor. Lo que NO hace es crear el aviso de "mensaje
// nuevo" en la campana: los cumpleaños ya tienen su propio aviso (el dia antes y
// el mismo dia), y con los dos cada persona recibia el mismo aviso repetido.
// ----------------------------------------------------------------------

const COLECCION_CONVERSACIONES = 'conversaciones_chat';
const SUBCOLECCION_MENSAJES = 'mensajes';

/**
 * Escribe cada mensaje en la conversacion de su receptor con Sistema.
 * Devuelve las claves `idMiembros:idMensaje` que salieron de verdad: si el
 * mensaje ya estaba (la tarea corrio dos veces), no se repite ni suma no leidos.
 *
 * `reenviar`: el mensaje que ya estaba se REHACE en su sitio —texto nuevo, hora
 * de ahora, sin visto— y vuelve a quedar como no leido. Sirve para mandar otra
 * vez el aviso del dia tras cambiar su formato sin dejar dos iguales en el chat
 * ni borrar nada.
 */
export async function escribirMensajesDeSistema({
  db,
  FieldValue,
  mensajes = [],
  ahora,
  reenviar = false,
  soloContenido = false,
}) {
  const enviados = [];
  const omitidos = [];

  for (const mensaje of mensajes) {
    const idConversacion = idConversacionConSistema(mensaje.idMiembros);
    const referenciaConversacion = db.collection(COLECCION_CONVERSACIONES).doc(idConversacion);
    const referenciaMensaje = referenciaConversacion
      .collection(SUBCOLECCION_MENSAJES)
      .doc(mensaje.idMensaje);
    const clave = `${mensaje.idMiembros}:${mensaje.idMensaje}`;

    const [yaEnviado, conversacion] = await Promise.all([
      referenciaMensaje.get(),
      referenciaConversacion.get(),
    ]);

    // `soloContenido`: el mensaje que ya estaba se corrige (texto y tarjeta) sin
    // tocar su hora ni los no leidos: arreglar como se ve un aviso no es volver a
    // avisar. El que no estaba, no se crea.
    if (soloContenido) {
      if (yaEnviado.exists) {
        await referenciaMensaje.update({
          texto: mensaje.texto,
          metadatos: createChatMessageDocument({
            message: {
              idMensaje: mensaje.idMensaje,
              texto: mensaje.texto,
              remitenteIdMiembros: CUENTA_SISTEMA.idMiembros,
              metadatos: mensaje.metadatos,
            },
            conversationId: idConversacion,
          }).metadatos,
        });
        enviados.push(clave);
      } else omitidos.push(clave);
      continue;
    }

    if (yaEnviado.exists && !reenviar) {
      omitidos.push(clave);
      continue;
    }

    const documento = createChatMessageDocument({
      message: {
        idMensaje: mensaje.idMensaje,
        texto: mensaje.texto,
        tipoContenido: 'text',
        remitenteIdMiembros: CUENTA_SISTEMA.idMiembros,
        metadatos: mensaje.metadatos,
        enviadoEn: ahora,
      },
      fallbackSender: participanteSistema(),
      conversationId: idConversacion,
    });
    const ultimoMensaje = {
      idMensaje: documento.idMensaje,
      texto: documento.texto,
      tipoContenido: documento.tipoContenido,
      remitenteIdMiembros: documento.remitenteIdMiembros,
      enviadoEn: documento.enviadoEn,
    };
    const lote = db.batch();

    lote.set(referenciaMensaje, documento);

    if (conversacion.exists) {
      const noLeidos = Number(
        conversacion.data()?.noLeidosPorIdMiembros?.[String(mensaje.idMiembros)] || 0
      );

      lote.update(referenciaConversacion, {
        actualizadoEn: documento.enviadoEn,
        ultimoMensaje,
        // Rehecho, el mismo mensaje no cuenta dos veces: si ya estaba sin leer se
        // queda como estaba; si lo habia leido, vuelve a uno.
        [`noLeidosPorIdMiembros.${mensaje.idMiembros}`]: yaEnviado.exists
          ? Math.max(noLeidos, 1)
          : FieldValue.increment(1),
        // Si la habia borrado, el aviso nuevo la trae de vuelta.
        eliminada: false,
        activa: true,
      });
    } else {
      const participantesIds = [Number(mensaje.idMiembros), CUENTA_SISTEMA.idMiembros].sort(
        (a, b) => a - b
      );

      lote.set(referenciaConversacion, {
        idConversacion,
        tipoConversacion: 'INDIVIDUAL',
        nombreGrupo: null,
        avatarGrupoUrl: null,
        participantesIds,
        participantes: [mensaje.participante, participanteSistema()].sort(
          (a, b) => a.idMiembros - b.idMiembros
        ),
        creadoPorIdMiembros: CUENTA_SISTEMA.idMiembros,
        administradoresIds: [],
        creadoEn: documento.enviadoEn,
        actualizadoEn: documento.enviadoEn,
        ultimoMensaje,
        noLeidosPorIdMiembros: {
          [String(mensaje.idMiembros)]: 1,
          [String(CUENTA_SISTEMA.idMiembros)]: 0,
        },
        activa: true,
        eliminada: false,
      });
    }

    await lote.commit();
    enviados.push(clave);
  }

  return { enviados, omitidos };
}

/**
 * Los cumpleaños del dia en el chat de Sistema: calcula el reparto, lo escribe
 * y deja constancia en el registro. Un destacamento que falla no para a los
 * demas; se devuelve en `errores`.
 *
 * `cumpleaneros`, si viene, sustituye al calculo del dia: la prueba a mano lo
 * usa para lanzar un cumpleaños concreto.
 */
export async function enviarCumpleanosPorChatDeSistema({
  db,
  FieldValue,
  miembros = [],
  cuentasPorMiembro = {},
  fotos = {},
  nombresDeDestacamentos = {},
  hoy = new Date(),
  cumpleaneros = null,
  origen = 'programado',
  reenviar = false,
  soloContenido = false,
}) {
  const fechaClave = fechaClaveLocal(hoy);
  const ahora = new Date().toISOString();
  const envios = repartoDelChatDeCumpleanos({
    cumpleaneros:
      cumpleaneros ?? cumpleanosDelDia(miembros, { hoy, diasAviso: DIAS_DE_AVISO_CHAT }),
    miembros,
    cuentasPorMiembro,
    fotos,
    nombresDeDestacamentos,
    fechaClave,
  });
  const registros = [];
  const errores = [];

  for (const envio of envios) {
    try {
      const { enviados } = await escribirMensajesDeSistema({
        db,
        FieldValue,
        mensajes: envio.mensajes,
        ahora,
        reenviar,
        soloContenido,
      });

      // Corregir como se ve no es un envio: no entra en el registro.
      if (soloContenido) {
        registros.push({ ...envio, cantidadMensajes: enviados.length, corregidos: true });
        continue;
      }

      if (!enviados.length) continue;

      const registro = registroDelEnvio({ envio, enviados, fecha: new Date(), fechaClave, origen });

      await db.collection(COLECCION_REGISTRO_CHAT_SISTEMA).doc(registro.id).set(registro);
      registros.push(registro);
    } catch (error) {
      errores.push({ idDestacamento: envio.idDestacamento, mensaje: error?.message });
    }
  }

  return { registros, errores };
}
