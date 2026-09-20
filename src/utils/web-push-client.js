'use client';

import { WEB_PUSH_VAPID_PUBLIC_KEY } from 'src/utils/web-push-key';

import { AUTH } from 'src/lib/firebase';

const ENDPOINT_LOCAL_KEY = 'edr-web-push-endpoint';
const DESHABILITADA_LOCAL_KEY = 'edr-web-push-deshabilitada';

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

  let registro = await navigator.serviceWorker.getRegistration('/');
  if (!registro) {
    registro = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
      updateViaCache: 'none',
    });
  }

  if (registro.active) return registro;

  // `register()` resuelve antes de que el worker complete install/activate.
  // PushManager.subscribe requiere que ya haya un worker activo.
  await new Promise((resolve, reject) => {
    const trabajador = registro.installing || registro.waiting;
    if (!trabajador) {
      reject(new Error('El service worker no pudo activarse. Vuelve a intentarlo.'));
      return;
    }

    const temporizador = window.setTimeout(() => {
      trabajador.removeEventListener('statechange', revisarEstado);
      reject(new Error('El service worker tardó demasiado en activarse. Vuelve a intentarlo.'));
    }, 10000);

    const revisarEstado = () => {
      if (trabajador.state === 'activated') {
        window.clearTimeout(temporizador);
        trabajador.removeEventListener('statechange', revisarEstado);
        resolve();
      } else if (trabajador.state === 'redundant') {
        window.clearTimeout(temporizador);
        trabajador.removeEventListener('statechange', revisarEstado);
        reject(new Error('No se pudo activar el service worker. Vuelve a intentarlo.'));
      }
    };

    trabajador.addEventListener('statechange', revisarEstado);
    revisarEstado();
  });

  registro = await navigator.serviceWorker.getRegistration('/') || registro;
  if (!registro.active) throw new Error('El service worker no quedó activo. Vuelve a intentarlo.');
  return registro;
};

const guardarSuscripcion = async (suscripcion) => {
  await requestJson('POST', {
    subscription: suscripcion.toJSON(),
    plataforma: /iPhone|iPad|iPod/i.test(navigator.userAgent) ? 'ios' : 'web',
  });
  window.localStorage.setItem(ENDPOINT_LOCAL_KEY, suscripcion.endpoint);
  window.localStorage.removeItem(DESHABILITADA_LOCAL_KEY);
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
  if (window.localStorage.getItem(DESHABILITADA_LOCAL_KEY) === 'true') {
    return { compatible: true, permiso, habilitadas: false };
  }

  const registro = await obtenerRegistro();
  let suscripcion = await registro.pushManager.getSubscription();

  // Una suscripción existente es la señal fiable de que este navegador ya fue
  // habilitado. Algunos navegadores/restauraciones de perfil informan `default`
  // aunque el usuario ya concedió el permiso.
  if (permiso !== 'granted' && !suscripcion) {
    return { compatible: true, permiso, habilitadas: false };
  }

  if (!suscripcion) {
    try {
      suscripcion = await registro.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: decodeApplicationServerKey(WEB_PUSH_VAPID_PUBLIC_KEY),
      });
    } catch (error) {
      console.info('[push] el navegador requiere activar las notificaciones manualmente', error);
      return { compatible: true, permiso, habilitadas: false };
    }
  }

  const endpoint = suscripcion.endpoint;
  const estado = await requestJson('GET', undefined, `?endpoint=${encodeURIComponent(endpoint)}`);

  if (!estado.habilitadas) {
    // El endpoint puede haber caducado y el servidor haber eliminado el
    // registro. Rotarlo crea un endpoint válido en vez de volver a guardar el
    // mismo endpoint vencido.
    await suscripcion.unsubscribe();
    suscripcion = await registro.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: decodeApplicationServerKey(WEB_PUSH_VAPID_PUBLIC_KEY),
    });
    await guardarSuscripcion(suscripcion);
  } else {
    window.localStorage.setItem(ENDPOINT_LOCAL_KEY, endpoint);
  }
  return { compatible: true, permiso, habilitadas: true };
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

  await guardarSuscripcion(suscripcion);
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
  window.localStorage.setItem(DESHABILITADA_LOCAL_KEY, 'true');
}
