import 'server-only';

import webpush from 'web-push';

import { WEB_PUSH_VAPID_PUBLIC_KEY } from 'src/utils/web-push-key';

import { getAdminDb, isAdminConfigured } from 'src/server/firebase-admin';

const COLECCION = 'web_push_subscriptions';
const maximoPorConsulta = 30;
const dividir = (valores, tamano) => {
  const grupos = [];
  for (let inicio = 0; inicio < valores.length; inicio += tamano) {
    grupos.push(valores.slice(inicio, inicio + tamano));
  }
  return grupos;
};

let vapidConfigurado = false;
const prepararWebPush = () => {
  if (vapidConfigurado) return true;

  const privada = process.env.WEB_PUSH_VAPID_PRIVATE_KEY;
  const asunto = process.env.WEB_PUSH_VAPID_SUBJECT;
  if (!privada || !asunto) return false;

  webpush.setVapidDetails(asunto, WEB_PUSH_VAPID_PUBLIC_KEY, privada);
  vapidConfigurado = true;
  return true;
};

export async function enviarPushAUsuarios({
  idsUsuarios = [],
  titulo,
  mensaje,
  ruta = '/dashboard',
}) {
  if (!isAdminConfigured()) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT no está configurado para consultar suscripciones.');
  }
  if (!prepararWebPush()) {
    throw new Error('Configura WEB_PUSH_VAPID_PRIVATE_KEY y WEB_PUSH_VAPID_SUBJECT para enviar Web Push.');
  }

  const usuarios = [...new Set(idsUsuarios.map((id) => String(id || '').trim()).filter(Boolean))];
  if (!usuarios.length) return { enviados: 0, fallidos: 0, dispositivos: 0 };

  const db = getAdminDb();
  const registros = [];
  for (const grupo of dividir(usuarios, maximoPorConsulta)) {
    const snapshot = await db.collection(COLECCION).where('uid', 'in', grupo).get();
    registros.push(...snapshot.docs.map((documento) => ({ id: documento.id, ...documento.data() })));
  }

  const destino = String(ruta || '/dashboard');
  const rutaSegura = destino.startsWith('/') && !destino.startsWith('//') ? destino : '/dashboard';
  const payload = JSON.stringify({
    title: String(titulo || 'Exploradores del Rey').slice(0, 120),
    body: String(mensaje || 'Tienes una nueva notificación.').slice(0, 500),
    url: rutaSegura,
  });
  const respuesta = await Promise.allSettled(
    registros.map((registro) => webpush.sendNotification(registro.subscription, payload, { TTL: 60 * 60 }))
  );

  const paraEliminar = [];
  respuesta.forEach((resultado, indice) => {
    if (resultado.status === 'fulfilled') return;
    const statusCode = Number(resultado.reason?.statusCode);
    if (statusCode === 404 || statusCode === 410) {
      paraEliminar.push(db.collection(COLECCION).doc(registros[indice].id).delete());
    }
  });
  await Promise.all(paraEliminar);

  const enviados = respuesta.filter((resultado) => resultado.status === 'fulfilled').length;
  return {
    enviados,
    fallidos: respuesta.length - enviados,
    dispositivos: registros.length,
  };
}
