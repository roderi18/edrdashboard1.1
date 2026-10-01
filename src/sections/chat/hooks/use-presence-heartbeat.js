import { useRef, useEffect, useCallback } from 'react';

import {
  setPresenceSession,
  setBuzonesQueAtiende,
  removePresenceSession,
  HEARTBEAT_INTERVAL_MS,
  podarSesionesCaducadas,
  setManualPresenceOverride,
} from 'src/lib/chat-presence';

// ----------------------------------------------------------------------

const LEGACY_OVERRIDE_STORAGE_KEY = 'chat-presence-override';
const LEGACY_OVERRIDE_STORAGE_PREFIX = 'chat-presence-override:';
const LEGACY_TAB_STORAGE_PREFIX = 'chat-presence-tab:';

const clearLegacyPresenceState = (idMiembros) => {
  if (typeof window === 'undefined') return;

  window.sessionStorage.removeItem(LEGACY_OVERRIDE_STORAGE_KEY);
  window.localStorage.removeItem(`${LEGACY_OVERRIDE_STORAGE_PREFIX}${idMiembros}`);

  const tabPrefix = `${LEGACY_TAB_STORAGE_PREFIX}${idMiembros}:`;

  for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
    const key = window.localStorage.key(index);

    if (key?.startsWith(tabPrefix)) {
      window.localStorage.removeItem(key);
    }
  }
};

/**
 * Cada pestaña/dispositivo mantiene su propia sesión en Firestore. Los lectores
 * agregan todas las sesiones: basta una visible para que el miembro esté online.
 */
export function usePresenceHeartbeat(idMiembros, { atiende } = {}) {
  const sessionIdRef = useRef(null);
  const publishPresenceRef = useRef(() => {});
  const atiendeKey = Array.isArray(atiende) ? [...atiende].sort().join(',') : '';

  if (!sessionIdRef.current && typeof crypto !== 'undefined') {
    sessionIdRef.current = crypto.randomUUID();
  }

  const setManualOverride = useCallback(
    (estado) => {
      if (!idMiembros) return;

      Promise.all([
        setManualPresenceOverride(idMiembros, estado),
        publishPresenceRef.current(),
      ]).catch((error) => {
        console.error('[chat] no se pudo cambiar la presencia', error);
      });
    },
    [idMiembros]
  );

  useEffect(() => {
    if (!idMiembros || !sessionIdRef.current || typeof window === 'undefined') return undefined;

    const sessionId = sessionIdRef.current;
    const atiendeLista = atiendeKey ? atiendeKey.split(',') : atiende ? [] : undefined;
    clearLegacyPresenceState(idMiembros);

    const publishPresence = () =>
      setPresenceSession(idMiembros, sessionId, {
        visible: document.visibilityState === 'visible',
      }).catch((error) => {
        console.error('[chat] no se pudo sincronizar la presencia', error);
      });

    const removeSession = () => {
      void removePresenceSession(idMiembros, sessionId);
    };

    publishPresenceRef.current = publishPresence;
    publishPresence();

    podarSesionesCaducadas(idMiembros).catch(() => {
      // Limpiar es una comodidad: si falla, la presencia sigue igual.
    });

    if (atiendeLista) {
      setBuzonesQueAtiende(idMiembros, atiendeLista).catch(() => {
        // Sin las reglas publicadas se rechaza; la presencia propia no depende de esto.
      });
    }

    const intervalId = window.setInterval(publishPresence, HEARTBEAT_INTERVAL_MS);
    document.addEventListener('visibilitychange', publishPresence);
    window.addEventListener('pagehide', removeSession);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', publishPresence);
      window.removeEventListener('pagehide', removeSession);
      removeSession();
      publishPresenceRef.current = () => {};
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idMiembros, atiendeKey]);

  return { setManualOverride };
}
