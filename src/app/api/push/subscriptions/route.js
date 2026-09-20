import { createHash } from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';

import { identificarConSesionRest } from 'src/server/sesion-rest.mjs';
import { getAdminDb, isAdminConfigured } from 'src/server/firebase-admin';

export const runtime = 'nodejs';

const COLECCION = 'web_push_subscriptions';
const errorJson = (error, status) => Response.json({ error }, { status });
const subscriptionId = (uid, endpoint) =>
  createHash('sha256').update(`${uid}:${endpoint}`).digest('hex');
const esEndpointPushValido = (endpoint) => {
  if (typeof endpoint !== 'string' || endpoint.length > 4096) return false;
  try {
    const url = new URL(endpoint);
    const host = url.hostname.toLowerCase();
    return (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      !url.port &&
      (host === 'google.com' ||
        host.endsWith('.google.com') ||
        host === 'fcm.googleapis.com' ||
        host === 'web.push.apple.com' ||
        host === 'updates.push.services.mozilla.com' ||
        host.endsWith('.notify.windows.com'))
    );
  } catch {
    return false;
  }
};

async function autenticar(request) {
  const { error, quien } = await identificarConSesionRest(request);
  if (error) return { response: error };
  if (!isAdminConfigured()) {
    return { response: errorJson('El servicio de notificaciones no está configurado.', 503) };
  }
  return { uid: quien.uid, db: getAdminDb() };
}

export async function GET(request) {
  try {
    const { response, uid, db } = await autenticar(request);
    if (response) return response;

    const endpoint = String(new URL(request.url).searchParams.get('endpoint') || '');
    if (!endpoint) {
      return Response.json({ habilitadas: false }, { headers: { 'Cache-Control': 'no-store' } });
    }
    const registro = await db.collection(COLECCION).doc(subscriptionId(uid, endpoint)).get();
    return Response.json(
      { habilitadas: registro.exists },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('[push/subscriptions] no se pudo consultar el estado', error);
    return errorJson('No se pudo consultar el estado de las notificaciones.', 500);
  }
}

export async function POST(request) {
  try {
    const { response, uid, db } = await autenticar(request);
    if (response) return response;

    const { subscription, plataforma = 'web' } = await request.json().catch(() => ({}));
    const endpoint = subscription?.endpoint;
    const keys = subscription?.keys;
    if (
      !esEndpointPushValido(endpoint) ||
      typeof keys?.p256dh !== 'string' ||
      typeof keys?.auth !== 'string' ||
      keys.p256dh.length > 256 ||
      keys.auth.length > 256
    ) {
      return errorJson('La suscripción de este dispositivo no es válida.', 400);
    }

    const referencia = db.collection(COLECCION).doc(subscriptionId(uid, endpoint));
    await referencia.set(
      {
        uid,
        endpoint,
        subscription: { endpoint, keys },
        plataforma: plataforma === 'ios' ? 'ios' : 'web',
        userAgent: String(request.headers.get('user-agent') || '').slice(0, 500),
        creadoEn: FieldValue.serverTimestamp(),
        actualizadoEn: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return Response.json({ guardado: true });
  } catch (error) {
    console.error('[push/subscriptions] no se pudo guardar el dispositivo', error);
    return errorJson('No se pudo activar este dispositivo para notificaciones.', 500);
  }
}

export async function DELETE(request) {
  try {
    const { response, uid, db } = await autenticar(request);
    if (response) return response;

    const { endpoint = '' } = await request.json().catch(() => ({}));
    if (!esEndpointPushValido(endpoint)) {
      return errorJson('La suscripción de este dispositivo no es válida.', 400);
    }
    const referencia = db.collection(COLECCION);
    await referencia.doc(subscriptionId(uid, endpoint)).delete();

    return Response.json({ eliminado: true });
  } catch (error) {
    console.error('[push/subscriptions] no se pudo desactivar el dispositivo', error);
    return errorJson('No se pudo desactivar este dispositivo.', 500);
  }
}
