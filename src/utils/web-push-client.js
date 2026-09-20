'use client';

import { WEB_PUSH_VAPID_PUBLIC_KEY } from 'src/utils/web-push-key';

import { AUTH } from 'src/lib/firebase';

const ENDPOINT_LOCAL_KEY = 'edr-web-push-endpoint';

const decodeApplicationServerKey = (key) => {
  const padding = '='.repeat((4 - (key.length % 4)) % 4);
  const base64 = (key + padding).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(window.atob(base64), (character) => character.charCodeAt(0));
};

const requestJson = async (method, body, query = '') => {
  const authUser = AUTH?.currentUser;
  if (!authUser) throw new Error('Inicia sesión para configurar las notificaciones.');

  const response = await fetch(`/api/push/subscriptions${query}`, {
    method,
    headers: {
      Authorization: `Bearer ${await authUser.getIdToken()}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    cache: 'no-store',
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) throw new Error(data.error || 'No se pudo configurar el dispositivo.');
  return data;
};

const obtenerRegistro = async () => {
  if (!('serviceWorker' in navigator)) return null;
  return navigator.serviceWorker.register('/sw.js', { scope: '/' });
};

export async function consultarEstadoWebPush() {
  if (
    typeof window === 'undefined' ||
    !('Notification' in window) ||
    !('serviceWorker' in navigator) ||
    !('PushManager' in window)
  ) {
    return { compatible: false, permiso: 'unsupported', habilitadas: false };
  }

  const permiso = Notification.permission;
  const registro = await obtenerRegistro();
  const suscripcion = await registro.pushManager.getSubscription();
  const endpoint = suscripcion?.endpoint || window.localStorage.getItem(ENDPOINT_LOCAL_KEY) || '';

  if (!endpoint) return { compatible: true, permiso, habilitadas: false };
  const { habilitadas } = await requestJson('GET', undefined, `?endpoint=${encodeURIComponent(endpoint)}`);
  return { compatible: true, permiso, habilitadas: Boolean(habilitadas) };
}

export async function activarWebPush() {
  if (
    !('Notification' in window) ||
    !('serviceWorker' in navigator) ||
    !('PushManager' in window)
  ) {
    throw new Error('Este navegador no admite notificaciones web push.');
  }

  if (window.isSecureContext === false) {
    throw new Error('Las notificaciones requieren una conexión segura HTTPS.');
  }

  const permiso =
    Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
  if (permiso !== 'granted') {
    throw new Error('Permite las notificaciones en el navegador para activarlas.');
  }

  const registro = await obtenerRegistro();
  const suscripcion =
    (await registro.pushManager.getSubscription()) ||
    (await registro.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: decodeApplicationServerKey(WEB_PUSH_VAPID_PUBLIC_KEY),
    }));

  await requestJson('POST', {
    subscription: suscripcion.toJSON(),
    plataforma: /iPhone|iPad|iPod/i.test(navigator.userAgent) ? 'ios' : 'web',
  });
  window.localStorage.setItem(ENDPOINT_LOCAL_KEY, suscripcion.endpoint);
  return suscripcion;
}

export async function desactivarWebPush() {
  const registro = await obtenerRegistro();
  const suscripcion = await registro.pushManager.getSubscription();
  const endpoint = suscripcion?.endpoint || window.localStorage.getItem(ENDPOINT_LOCAL_KEY) || '';
  if (!endpoint) throw new Error('No se encontró el registro de este dispositivo.');

  await requestJson('DELETE', { endpoint });
  if (suscripcion) await suscripcion.unsubscribe();
  window.localStorage.removeItem(ENDPOINT_LOCAL_KEY);
}
