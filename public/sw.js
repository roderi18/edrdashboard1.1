const VERSION = 'edr-pwa-v3';
const STATIC_CACHE = `${VERSION}-static`;
const DATOS_CACHE = `${VERSION}-datos`;
const STATIC_ASSETS = [
  '/',
  '/offline.html',
  '/icon-192x192.png',
  '/icon-512x512.png',
  '/maskable-icon-192x192.png',
  '/maskable-icon-512x512.png',
  '/logo/logo-single.png',
];

const STATIC_PATHS = [
  '/assets/',
  '/fonts/',
  '/icons/',
  '/logo/',
  '/icon-',
  '/maskable-icon-',
];

// ----------------------------------------------------------------------
// LO QUE HACE FALTA PARA PASAR LISTA SIN SEÑAL.
//
// La asistencia se GUARDA en Firestore, que ya sabe funcionar sin conexion. Lo
// que no sabe es de donde salen los miembros y los destacamentos: eso viene de
// la API externa por estas rutas, que corren en el servidor. Sin red no hay
// servidor, asi que la pantalla se quedaba sin gente a la que marcar.
//
// Se guarda la ultima respuesta buena de cada una y se sirve cuando la red
// falla. Solo estas cuatro: son las que carga la pantalla de asistencia.
//
// NO se cachea nada de la dispensa medica ni de las fichas completas: en un
// telefono compartido o perdido, lo cacheado se queda en el disco.
// ----------------------------------------------------------------------
const RUTAS_CON_MEMORIA = ['/api/members/', '/api/dest/', '/api/churches/', '/api/sectional/'];

const tieneMemoria = (pathname) =>
  RUTAS_CON_MEMORIA.some((ruta) => pathname === ruta || pathname === ruta.slice(0, -1));

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => !key.startsWith(VERSION)).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  if (url.pathname.startsWith('/api/')) {
    // Solo las de la pantalla de asistencia; el resto de la API sigue sin tocar.
    if (tieneMemoria(url.pathname)) {
      event.respondWith(redPrimeroConMemoria(request));
    }

    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('/offline.html')));
    return;
  }

  if (STATIC_PATHS.some((path) => url.pathname.startsWith(path))) {
    event.respondWith(cacheFirst(request));
  }
});

self.addEventListener('push', (event) => {
  if (!event.data) {
    return;
  }

  const data = event.data.json();
  const title = data.title || 'Exploradores del Rey';

  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body,
      icon: data.icon || '/icon-192x192.png',
      badge: data.badge || '/icon-192x192.png',
      data: {
        url: data.url || '/',
      },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      const existingClient = clientList.find((client) => client.url === targetUrl);

      if (existingClient) {
        return existingClient.focus();
      }

      return self.clients.openWindow(targetUrl);
    })
  );
});

// LA RED MANDA, Y LA MEMORIA SALVA.
//
// Se pide siempre a la red: estando conectado, los datos son los de ahora. Solo
// si falla se responde con lo ultimo que se guardo. Al reves —memoria primero—
// se pasaria lista contra un padron viejo sin saberlo.
//
// Las respuestas de error no se guardan: un 401 cacheado dejaria la pantalla
// vacia hasta que alguien limpiara el navegador.
async function redPrimeroConMemoria(request) {
  const cache = await caches.open(DATOS_CACHE);

  try {
    const response = await fetch(request);

    if (response && response.ok) {
      cache.put(request, response.clone());
    }

    return response;
  } catch (error) {
    const guardada = await cache.match(request);

    if (guardada) return guardada;

    throw error;
  }
}

async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);

  if (cachedResponse) {
    return cachedResponse;
  }

  const response = await fetch(request);

  if (!response.ok) {
    return response;
  }

  const cache = await caches.open(STATIC_CACHE);

  cache.put(request, response.clone());

  return response;
}
