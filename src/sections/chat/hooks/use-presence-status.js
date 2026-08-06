import { useMemo, useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';

import { FIRESTORE, isFirebaseConfigured } from 'src/lib/firebase';
import { STALE_AFTER_MS, COLECCION_PRESENCIA } from 'src/lib/chat-presence';

import { derivePresenceSnapshot } from '../utils/presence-state.mjs';

// ----------------------------------------------------------------------

const OFFLINE_PRESENCE = { status: 'offline', lastActivity: null };

/**
 * Escucha el documento agregado de presencia de cada miembro. El documento
 * contiene una sesión independiente por pestaña/dispositivo.
 */
export function usePresenceStatuses(idMiembrosList = []) {
  const ids = useMemo(
    () => [...new Set(idMiembrosList.filter(Boolean).map(String))].sort(),
    [idMiembrosList]
  );
  const idsKey = ids.join(',');

  const [statuses, setStatuses] = useState({});

  useEffect(() => {
    if (!isFirebaseConfigured || !FIRESTORE || !idsKey) {
      setStatuses({});
      return undefined;
    }

    const staleTimeouts = new Map();
    const publishStatus = (id, presence) => {
      const nextPresence = derivePresenceSnapshot({
        presence,
        staleAfterMs: STALE_AFTER_MS,
      });
      const existingTimeout = staleTimeouts.get(id);

      if (existingTimeout) clearTimeout(existingTimeout);

      setStatuses((current) => ({ ...current, [id]: nextPresence }));

      if (nextPresence.status !== 'offline' && nextPresence.lastActivity) {
        const remaining = STALE_AFTER_MS - (Date.now() - nextPresence.lastActivity.getTime());

        staleTimeouts.set(
          id,
          setTimeout(() => {
            setStatuses((current) => ({
              ...current,
              [id]: derivePresenceSnapshot({
                presence,
                now: Date.now(),
                staleAfterMs: STALE_AFTER_MS,
              }),
            }));
          }, Math.max(remaining, 0) + 25)
        );
      }
    };

    const unsubscribers = idsKey.split(',').map((id) =>
      onSnapshot(
        doc(FIRESTORE, COLECCION_PRESENCIA, id),
        (snapshot) => publishStatus(id, snapshot.data() ?? {}),
        (error) => {
          console.error('[chat] error leyendo presencia', error);
        }
      )
    );

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
      staleTimeouts.forEach((timeoutId) => clearTimeout(timeoutId));
    };
  }, [idsKey]);

  return statuses;
}

export function usePresenceStatus(idMiembros) {
  const statuses = usePresenceStatuses(idMiembros ? [idMiembros] : []);

  return statuses[String(idMiembros)] ?? OFFLINE_PRESENCE;
}
