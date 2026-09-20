'use client';

import { useEffect } from 'react';

// ----------------------------------------------------------------------

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
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
