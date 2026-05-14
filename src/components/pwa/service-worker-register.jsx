'use client';

import { useEffect } from 'react';

// ----------------------------------------------------------------------

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) {
      return undefined;
    }

    let active = true;

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

    window.addEventListener('load', registerServiceWorker);

    return () => {
      active = false;
      window.removeEventListener('load', registerServiceWorker);
    };
  }, []);

  return null;
}
