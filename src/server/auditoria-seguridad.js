import 'server-only';

import { FieldValue } from 'firebase-admin/firestore';

import {
  unaVezCada,
  contextoDePeticion,
  escribirEnLogDelServidor,
  construirEventoDeSeguridad,
} from 'src/utils/auditoria-seguridad.mjs';

import { ipDelCliente } from 'src/server/ip-del-cliente.mjs';
import { COLECCIONES } from 'src/config/esquema-firestore.mjs';
import { getAdminDb, isAdminConfigured } from 'src/server/firebase-admin';

export { ACCIONES_DE_SEGURIDAD } from 'src/utils/auditoria-seguridad.mjs';

// ----------------------------------------------------------------------
// Escribe un evento de seguridad: SIEMPRE en los logs del servidor y, salvo que
// se pida lo contrario, en `auditoria_seguridad` con el Admin SDK. Esa coleccion
// no la escribe nadie desde el navegador (`firestore.rules`), asi que lo que hay
// ahi lo puso el servidor.
//
// Nunca lanza ni tumba la peticion: un registro que falla se avisa en consola,
// pero cambiar una contraseña no puede fallar porque Firestore tarde. Se espera
// con un tope corto porque en Cloud Run lo que sigue despues de responder puede
// no llegar a ejecutarse.
// ----------------------------------------------------------------------

const TOPE_ESCRITURA_MS = 2000;

const conTope = (promesa, ms) =>
  Promise.race([
    promesa,
    new Promise((resolve) => {
      setTimeout(() => resolve('tope'), ms);
    }),
  ]);

/**
 * @param {Request} req La peticion (de ella salen IP, navegador y ruta).
 * @param {object} datos `{ accion, resultado, actor, objetivo, detalle }`.
 * @param {object} opciones `persistir: false` deja solo la linea de log (para
 *   lo frecuente, como cada consulta del padron). `unaVezCada: { clave, ms }`
 *   evita repetir el mismo evento en rafaga.
 */
export const registrarEventoDeSeguridad = async (req, datos, opciones = {}) => {
  const { persistir = true, unaVezCada: repeticion = null } = opciones;

  try {
    if (repeticion && !unaVezCada(repeticion.clave, repeticion.ms)) return null;

    const evento = construirEventoDeSeguridad({
      ...datos,
      ...contextoDePeticion(req, ipDelCliente),
    });

    escribirEnLogDelServidor(evento);

    if (!persistir || !isAdminConfigured()) return evento;

    const escritura = getAdminDb()
      .collection(COLECCIONES.auditoriaSeguridad)
      .add({ ...evento, fechaServidor: FieldValue.serverTimestamp() })
      .catch((error) => {
        console.error('[auditoria-seguridad] no se pudo guardar', {
          accion: evento.accion,
          mensaje: error?.message,
        });
      });

    await conTope(escritura, TOPE_ESCRITURA_MS);

    return evento;
  } catch (error) {
    console.error('[auditoria-seguridad] evento descartado', {
      accion: datos?.accion,
      mensaje: error?.message,
    });

    return null;
  }
};
