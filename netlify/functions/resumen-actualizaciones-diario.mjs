import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import webpush from 'web-push';

import { WEB_PUSH_VAPID_PUBLIC_KEY } from '../../src/utils/web-push-key.js';
import { COLECCION_NOTIFICACIONES } from '../../src/server/cumpleanos-core.mjs';
import {
  COLECCION_ACTUALIZACIONES,
  construirAvisoDeResumen,
  leerDestinatariosDelResumen,
  contarDestacamentosActualizados,
} from '../../src/utils/resumen-actualizaciones-destacamentos.mjs';

// ----------------------------------------------------------------------
// CADA DÍA A LAS 9:00 (Santo Domingo): cuántos destacamentos van actualizados.
//
// Cuenta los envíos de la landing de registro (uno por destacamento) y avisa a
// Oficina Nacional y Administrador Global en la campana y por push. La regla y
// el texto están en `resumen-actualizaciones-destacamentos.mjs`.
//
// 13:00 UTC son las 9:00 en República Dominicana (UTC-4, sin horario de verano).
// Netlify solo ejecuta funciones programadas en el despliegue publicado.
// ----------------------------------------------------------------------

export const config = {
  schedule: '0 13 * * *',
};

const COLECCION_SUSCRIPCIONES_PUSH = 'web_push_subscriptions';
const TAMANO_GRUPO_PUSH = 30;

// Mismo arranque que `cumpleanos-diarios.mjs`: aquí no se puede cargar
// `src/server/firebase-admin`, que empieza con `import 'server-only'`.
const conexion = () => {
  const credencial = process.env.FIREBASE_SERVICE_ACCOUNT;

  if (!credencial) return null;

  const cuenta = JSON.parse(credencial);
  const app =
    getApps()[0] ??
    initializeApp({
      credential: cert({
        projectId: cuenta.project_id ?? cuenta.projectId,
        clientEmail: cuenta.client_email ?? cuenta.clientEmail,
        privateKey: String(cuenta.private_key ?? cuenta.privateKey ?? '')
          .split('\\n')
          .join('\n'),
      }),
    });

  return getFirestore(app);
};

const enviarPush = async (db, aviso) => {
  const clavePrivada = process.env.WEB_PUSH_VAPID_PRIVATE_KEY;
  const asunto = process.env.WEB_PUSH_VAPID_SUBJECT;

  if (!clavePrivada || !asunto) {
    console.warn(
      '[resumen-actualizaciones] falta configurar Web Push; el aviso quedó en la campana'
    );
    return;
  }
  webpush.setVapidDetails(asunto, WEB_PUSH_VAPID_PUBLIC_KEY, clavePrivada);

  // Si la tarea corre dos veces el mismo día, la push sale una sola vez.
  const referencia = db.collection(COLECCION_NOTIFICACIONES).doc(aviso.id);
  const puedeEnviar = await db.runTransaction(async (transaccion) => {
    const existente = (await transaccion.get(referencia)).data() || {};

    if (existente.pushEnviadoEn || existente.pushEnviandoHasta > Date.now()) return false;
    transaccion.update(referencia, { pushEnviandoHasta: Date.now() + 60_000 });
    return true;
  });

  if (!puedeEnviar) return;

  try {
    const suscripciones = [];
    const uids = aviso.idsDestinatarios;

    for (let inicio = 0; inicio < uids.length; inicio += TAMANO_GRUPO_PUSH) {
      const snapshot = await db
        .collection(COLECCION_SUSCRIPCIONES_PUSH)
        .where('uid', 'in', uids.slice(inicio, inicio + TAMANO_GRUPO_PUSH))
        .get();
      suscripciones.push(...snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    }

    const payload = JSON.stringify({ title: aviso.titulo, body: aviso.mensaje, url: aviso.ruta });
    const resultados = await Promise.allSettled(
      suscripciones.map(({ subscription }) =>
        webpush.sendNotification(subscription, payload, { TTL: 60 * 60 })
      )
    );

    // Las suscripciones que el navegador ya dio de baja se limpian, como en cumpleaños.
    await Promise.all(
      resultados.map((resultado, indice) =>
        resultado.status === 'rejected' && [404, 410].includes(Number(resultado.reason?.statusCode))
          ? db.collection(COLECCION_SUSCRIPCIONES_PUSH).doc(suscripciones[indice].id).delete()
          : null
      )
    );

    const enviados = resultados.filter((r) => r.status === 'fulfilled').length;
    await referencia.update({
      pushEnviadoEn: FieldValue.serverTimestamp(),
      pushEnviandoHasta: FieldValue.delete(),
      pushDispositivosDestino: suscripciones.length,
      pushEnviados: enviados,
      pushFallidos: resultados.length - enviados,
    });
    console.info(
      `[resumen-actualizaciones] push: ${enviados}/${suscripciones.length} dispositivo(s)`
    );
  } catch (error) {
    await referencia.update({ pushEnviandoHasta: FieldValue.delete() }).catch(() => {});
    console.error('[resumen-actualizaciones] no se pudo enviar la push', error);
  }
};

export default async function handler() {
  const db = conexion();

  if (!db) {
    console.warn('[resumen-actualizaciones] sin FIREBASE_SERVICE_ACCOUNT');
    return new Response('Sin credenciales de administrador.', { status: 503 });
  }

  try {
    const [snapshot, idsDestinatarios] = await Promise.all([
      db
        .collection(COLECCION_ACTUALIZACIONES)
        .select('destacamento', 'nombreDestacamento', 'seccion')
        .get(),
      leerDestinatariosDelResumen(db),
    ]);

    if (!idsDestinatarios.length) {
      return new Response('Nadie ejerce Oficina Nacional ni Administrador Global.', {
        status: 200,
      });
    }

    const conteo = contarDestacamentosActualizados(snapshot.docs.map((d) => d.data()));
    const aviso = construirAvisoDeResumen({ conteo, idsDestinatarios });

    // Una segunda pasada el mismo día solo pone la cifra al día: el aviso entero
    // lleva `leidaPor: []` y `estado: 'no_leida'`, y reescribirlo lo devolvería a
    // "no leído" para quien ya lo abrió.
    const referencia = db.collection(COLECCION_NOTIFICACIONES).doc(aviso.id);
    if ((await referencia.get()).exists) {
      const { mensaje, mensajeVisual, metadatos } = aviso;
      await referencia.update({ mensaje, mensajeVisual, metadatos, idsDestinatarios });
    } else {
      await referencia.set(aviso);
    }
    await enviarPush(db, aviso);

    const resumen = `${aviso.mensaje} Aviso a ${idsDestinatarios.length} cuenta(s).`;
    console.info(`[resumen-actualizaciones] ${resumen}`);
    return new Response(resumen, { status: 200 });
  } catch (error) {
    console.error('[resumen-actualizaciones] no se pudo enviar el resumen', error);
    return new Response(`No se pudo enviar el resumen: ${error?.message}`, { status: 500 });
  }
}
