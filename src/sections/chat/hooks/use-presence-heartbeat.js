import { useRef, useEffect, useCallback } from 'react';

import { setPresence, HEARTBEAT_INTERVAL_MS } from 'src/lib/chat-presence';

// ----------------------------------------------------------------------

const OVERRIDE_STORAGE_KEY = 'chat-presence-override';

const readOverride = () => {
  if (typeof window === 'undefined') return null;
  return window.sessionStorage.getItem(OVERRIDE_STORAGE_KEY);
};

/**
 * Mantiene viva la presencia del usuario actual con un heartbeat periódico.
 * Si el usuario forzó manualmente un estado (ocupado/desconectado) desde el
 * menú de cuenta, ese override tiene prioridad sobre la detección automática
 * por visibilidad de la pestaña (online cuando está visible, "always"/ausente
 * cuando está oculta).
 */
export function usePresenceHeartbeat(idMiembros) {
  const overrideRef = useRef(readOverride());

  const setManualOverride = useCallback(
    (estado) => {
      overrideRef.current = estado;

      if (typeof window !== 'undefined') {
        if (estado) {
          window.sessionStorage.setItem(OVERRIDE_STORAGE_KEY, estado);
        } else {
          window.sessionStorage.removeItem(OVERRIDE_STORAGE_KEY);
        }
      }

      if (idMiembros) {
        setPresence(idMiembros, estado || (document.visibilityState === 'visible' ? 'online' : 'always'));
      }
    },
    [idMiembros]
  );

  useEffect(() => {
    if (!idMiembros) return undefined;

    const currentEstado = () =>
      overrideRef.current || (document.visibilityState === 'visible' ? 'online' : 'always');

    const beat = () => setPresence(idMiembros, currentEstado());

    beat();

    const intervalId = setInterval(beat, HEARTBEAT_INTERVAL_MS);
    document.addEventListener('visibilitychange', beat);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', beat);
    };
  }, [idMiembros]);

  return { setManualOverride };
}
