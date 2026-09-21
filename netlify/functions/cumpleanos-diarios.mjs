import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import webpush from 'web-push';

import {
  DIAS_DE_AVISO,
  idDelMiembro,
  aceptaElAviso,
  cumpleanosDelDia,
  COLECCION_PREFERENCIAS,
  COLECCION_NOTIFICACIONES,
  destacamentoDelMiembro,
  construirAvisoDeCumpleanos,
  destinatariosDelDestacamento,
} from '../../src/server/cumpleanos-core.mjs';
import { enviarCumpleanosPorChatDeSistema } from '../../src/server/chat-sistema-envio.mjs';
import { WEB_PUSH_VAPID_PUBLIC_KEY } from '../../src/utils/web-push-key.js';
import {
  leerMiembros,
  leerFotosDeMiembros,
  leerCuentasPorMiembro,
  leerNombresDeDestacamentos,
} from '../../src/server/cumpleanos-lecturas.mjs';

// ----------------------------------------------------------------------
// EL BARRIDO DIARIO DE CUMPLEAÑOS.
//
// Corre una vez al dia y avisa a TODOS los miembros del destacamento: en la
// campana, de quien cumple mañana y de quien cumple hoy; en el chat de Sistema,
// ademas, de quien cumple dentro de siete dias (`chat-sistema-envio.mjs`).
//
// Por que una funcion programada y no la ruta `/api/notifications/birthdays`
// que ya existia: esa ruta escribe con el SDK de cliente y sin sesion, asi que
// sus escrituras morian en las reglas de Firestore. Nunca pudo funcionar, y
// nadie la llamaba. Aqui se escribe con el Admin SDK, que es lo unico que puede
// crear notificaciones a nombre del sistema.
//
// La hora: 11:00 UTC son las 07:00 en Republica Dominicana (UTC-4). Se avisa a
// primera hora, que es cuando sirve.
// ----------------------------------------------------------------------

export const config = {
  schedule: '0 11 * * *',
};

const COLECCION_SUSCRIPCIONES_PUSH = 'web_push_subscriptions';
const TAMANO_GRUPO_PUSH = 30;
let webPushConfigurado = false;

const enviarPushDeCumpleanos = async (db, aviso, idsDestinatarios) => {
  const clavePrivadaPush = process.env.WEB_PUSH_VAPID_PRIVATE_KEY;
  const asuntoPush = process.env.WEB_PUSH_VAPID_SUBJECT;

  if (!clavePrivadaPush || !asuntoPush) {
    console.warn('[cumpleanos] falta configurar Web Push; el aviso quedó en la campana');
    return;
  }

  if (!webPushConfigurado) {
    webpush.setVapidDetails(asuntoPush, WEB_PUSH_VAPID_PUBLIC_KEY, clavePrivadaPush);
    webPushConfigurado = true;
  }

  const referenciaAviso = db.collection(COLECCION_NOTIFICACIONES).doc(aviso.id);
  const puedeEnviar = await db.runTransaction(async (transaccion) => {
    const snapshot = await transaccion.get(referenciaAviso);
    const existente = snapshot.data() || {};

    if (existente.pushEnviadoEn || existente.pushEnviandoHasta > Date.now()) return false;

    transaccion.update(referenciaAviso, { pushEnviandoHasta: Date.now() + 60_000 });
    return true;
  });

  if (!puedeEnviar) return;

  try {
    const usuarios = [...new Set(idsDestinatarios.map((id) => String(id).trim()).filter(Boolean))];
    const suscripciones = [];

    for (let inicio = 0; inicio < usuarios.length; inicio += TAMANO_GRUPO_PUSH) {
      const grupo = usuarios.slice(inicio, inicio + TAMANO_GRUPO_PUSH);
      const snapshot = await db
        .collection(COLECCION_SUSCRIPCIONES_PUSH)
        .where('uid', 'in', grupo)
        .get();
      suscripciones.push(
        ...snapshot.docs.map((documento) => ({ id: documento.id, ...documento.data() }))
      );
    }

    const url = String(aviso.ruta || '/dashboard');
    const payload = JSON.stringify({
      title: String(aviso.titulo || 'Cumpleaños en tu destacamento').slice(0, 120),
      body: String(aviso.mensajeVisual || aviso.mensaje || '').slice(0, 500),
      url: url.startsWith('/') && !url.startsWith('//') ? url : '/dashboard',
    });
    const resultados = await Promise.allSettled(
      suscripciones.map(({ subscription }) =>
        webpush.sendNotification(subscription, payload, { TTL: 60 * 60 })
      )
    );
    const caducadas = [];

    resultados.forEach((resultado, indice) => {
      if (resultado.status !== 'rejected') return;
      const statusCode = Number(resultado.reason?.statusCode);
      if (statusCode === 404 || statusCode === 410) {
        caducadas.push(
          db.collection(COLECCION_SUSCRIPCIONES_PUSH).doc(suscripciones[indice].id).delete()
        );
      }
    });
    await Promise.all(caducadas);

    const enviados = resultados.filter((resultado) => resultado.status === 'fulfilled').length;
    await referenciaAviso.update({
      pushEnviadoEn: FieldValue.serverTimestamp(),
      pushEnviandoHasta: FieldValue.delete(),
      pushDispositivosDestino: suscripciones.length,
      pushEnviados: enviados,
      pushFallidos: resultados.length - enviados,
    });
    console.info(
      `[cumpleanos] push ${aviso.id}: ${enviados}/${suscripciones.length} dispositivo(s)`
    );
  } catch (error) {
    await referenciaAviso.update({ pushEnviandoHasta: FieldValue.delete() }).catch(() => {});
    console.error(`[cumpleanos] no se pudo enviar la push ${aviso.id}`, error);
  }
};

// El Admin SDK se inicializa AQUI y no se reutiliza `src/server/firebase-admin`:
// ese modulo empieza con `import 'server-only'`, que existe para reventar si
// alguien lo carga fuera de un componente de servidor de Next —y una funcion de
// Netlify lo esta—.
// La clave del service account suele viajar con los saltos de linea
// escapados (\n literal). Firebase la necesita con saltos de verdad.
const clavePrivada = (cuenta = {}) =>
  String(cuenta.private_key ?? cuenta.privateKey ?? '')
    .split('\\n')
    .join('\n');

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
        privateKey: clavePrivada(cuenta),
      }),
    });

  return getFirestore(app);
};

/** Quien apago los cumpleaños en sus preferencias se queda fuera. */
const quitarALosQueNoQuieren = async (db, idsDestinatarios, tipoNotificacion) => {
  const preferencias = await Promise.all(
    idsDestinatarios.map(async (idUsuario) => {
      const documento = await db
        .collection(COLECCION_PREFERENCIAS)
        .doc(String(idUsuario))
        .get()
        .catch(() => null);

      return { idUsuario, datos: documento?.exists ? documento.data() : null };
    })
  );

  return preferencias
    .filter(({ datos }) => aceptaElAviso(datos, tipoNotificacion))
    .map(({ idUsuario }) => idUsuario);
};

export default async function handler() {
  const db = conexion();

  if (!db) {
    console.warn('[cumpleanos] sin FIREBASE_SERVICE_ACCOUNT: no se puede avisar de nada');

    return new Response('Sin credenciales de administrador.', { status: 503 });
  }

  try {
    const [miembros, cuentasPorMiembro, fotos] = await Promise.all([
      leerMiembros(),
      leerCuentasPorMiembro(db),
      leerFotosDeMiembros(db),
    ]);

    const hoy = new Date();
    const cumpleaneros = cumpleanosDelDia(miembros, { hoy, diasAviso: DIAS_DE_AVISO });
    let enviados = 0;

    for (const { miembro, dias } of cumpleaneros) {
      const idDestacamento = destacamentoDelMiembro(miembro);
      const delDestacamento = destinatariosDelDestacamento({
        idDestacamento,
        miembros,
        cuentasPorMiembro,
        // El cumpleañero no se entera por una notificacion de su propio
        // cumpleaños: ya lo sabe, y felicitarse a si mismo no esta permitido.
        exceptoMiembro: idDelMiembro(miembro),
      });

      if (!delDestacamento.length) continue;

      const aviso = construirAvisoDeCumpleanos({
        miembro,
        dias,
        idsDestinatarios: [],
        hoy,
        urlFoto: fotos[idDelMiembro(miembro)]?.grande ?? '',
        urlFotoMiniatura: fotos[idDelMiembro(miembro)]?.mini ?? '',
      });
      const destinatarios = await quitarALosQueNoQuieren(
        db,
        delDestacamento,
        aviso.tipoNotificacion
      );

      if (!destinatarios.length) continue;

      // `merge` y no `set` a secas: si la tarea corre dos veces el mismo dia, la
      // segunda pasada no borra a quien ya lo marco como leido.
      await db
        .collection(COLECCION_NOTIFICACIONES)
        .doc(aviso.id)
        .set({ ...aviso, idsDestinatarios: destinatarios }, { merge: true });

      await enviarPushDeCumpleanos(db, aviso, destinatarios);

      enviados += 1;
    }

    // EL CHAT DE SISTEMA, despues de la campana y aparte: si el chat falla, los
    // avisos de la campana ya salieron. Avisa a los 7 dias, el dia antes y el
    // mismo dia, con un solo mensaje por destacamento.
    const chat = await enviarCumpleanosPorChatDeSistema({
      db,
      FieldValue,
      miembros,
      cuentasPorMiembro,
      fotos,
      nombresDeDestacamentos: await leerNombresDeDestacamentos(),
      hoy,
    }).catch((error) => {
      console.error('[cumpleanos] el chat de Sistema no se pudo enviar', error);
      return { registros: [], errores: [{ mensaje: error?.message }] };
    });
    const mensajesDeChat = chat.registros.reduce(
      (total, registro) => total + registro.cantidadMensajes,
      0
    );

    chat.errores.forEach((error) =>
      console.error('[cumpleanos] destacamento sin chat de Sistema', error)
    );

    const resumen = `${enviados} aviso(s) de cumpleaños de ${cumpleaneros.length} cumpleañero(s); ${mensajesDeChat} mensaje(s) de Sistema en ${chat.registros.length} destacamento(s).`;

    console.info(`[cumpleanos] ${resumen}`);

    return new Response(resumen, { status: 200 });
  } catch (error) {
    // Un fallo se registra y se devuelve: Netlify marca la ejecucion como
    // fallida y queda en su historial, que es donde se mira.
    console.error('[cumpleanos] no se pudo completar el barrido', error);

    return new Response(`No se pudo completar el barrido: ${error?.message}`, { status: 500 });
  }
}

// NOTA: la ruta `/api/notifications/birthdays` se retira con este cambio. Hacia
// lo mismo, pero escribia con el SDK de CLIENTE y sin sesion, asi que sus
// escrituras morian en las reglas de Firestore: nunca pudo mandar un aviso.
// Ademas no la llamaba nadie —ni cron, ni pantalla, ni script—, que es la razon
// de que el fallo no se notara nunca.
