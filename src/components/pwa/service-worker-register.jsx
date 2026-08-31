'use client';

import { useEffect } from 'react';

// ----------------------------------------------------------------------

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      return undefined;
    }

    if (process.env.NODE_ENV !== 'production') {
      // Un worker instalado por una ejecucion anterior de produccion puede
      // seguir controlando el mismo localhost durante el desarrollo. Al
      // retirarlo se evita que una recarga normal reutilice bundles antiguos.
      const removePreviousAppWorker = async () => {
        const registrations = await navigator.serviceWorker.getRegistrations();
        const hadController = Boolean(navigator.serviceWorker.controller);
        const results = await Promise.all(
          registrations.map((registration) => registration.unregister())
        );

        if ('caches' in window) {
          const cacheNames = await window.caches.keys();
          await Promise.all(
            cacheNames
              .filter((cacheName) => cacheName.startsWith('edr-pwa-'))
              .map((cacheName) => window.caches.delete(cacheName))
          );
        }

        if (hadController && results.some(Boolean)) {
          window.location.reload();
        }
      };

      removePreviousAppWorker().catch((error) => {
        console.warn('Previous service worker cleanup failed:', error);
      });

      return undefined;
    }

    let active = true;
    let reloadingForUpdate = false;
    const hadController = Boolean(navigator.serviceWorker.controller);

    const handleControllerChange = () => {
      // Si ya habia una version controlando la pagina, el cambio significa que
      // acaba de entrar una publicacion nueva. Una sola recarga evita mezclar
      // el HTML nuevo con estilos o JavaScript de la version anterior.
      if (!hadController || reloadingForUpdate) return;

      reloadingForUpdate = true;
      window.location.reload();
    };

    const registerServiceWorker = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
          updateViaCache: 'none',
        });

        if (active) {
          await registration.update();
        }
      } catch (error) {
        console.warn('Service worker registration failed:', error);
      }
    };

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
    window.addEventListener('load', registerServiceWorker);

    return () => {
      active = false;
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
      window.removeEventListener('load', registerServiceWorker);
    };
  }, []);

  return null;
}
