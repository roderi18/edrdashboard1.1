import { useMemo, useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';

import { FIRESTORE, isFirebaseConfigured } from 'src/lib/firebase';
import { STALE_AFTER_MS, COLECCION_PRESENCIA } from 'src/lib/chat-presence';

// ----------------------------------------------------------------------

const OFFLINE_PRESENCE = { status: 'offline', lastActivity: null };

const toMillis = (timestamp) => {
  if (!timestamp) return 0;
  if (typeof timestamp.toMillis === 'function') return timestamp.toMillis();

  const time = new Date(timestamp).getTime();
  return Number.isFinite(time) ? time : 0;
};

const deriveStatusFromDoc = (data) => {
  if (!data?.estado) return OFFLINE_PRESENCE;

  const lastActivityMs = toMillis(data.actualizadoEn);

  if (Date.now() - lastActivityMs > STALE_AFTER_MS) {
    return { status: 'offline', lastActivity: new Date(lastActivityMs) };
  }

  return { status: data.estado, lastActivity: new Date(lastActivityMs) };
};

/**
 * Presencia en vivo de varios participantes a la vez (un listener onSnapshot por id).
 * Sin Firebase Realtime Database no hay onDisconnect, así que una desconexión
 * (pestaña cerrada, sin red) se detecta por "staleness": si el último heartbeat
 * tiene más de STALE_AFTER_MS, se re-chequea y se degrada a 'offline' con un timer.
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

    const unsubscribers = idsKey.split(',').map((id) => {
      const presenceRef = doc(FIRESTORE, COLECCION_PRESENCIA, id);

      return onSnapshot(
        presenceRef,
        (snapshot) => {
          const existingTimeout = staleTimeouts.get(id);
          if (existingTimeout) clearTimeout(existingTimeout);

          const presence = deriveStatusFromDoc(snapshot.data());
          setStatuses((current) => ({ ...current, [id]: presence }));

          if (presence.status !== 'offline') {
            const remaining = STALE_AFTER_MS - (Date.now() - presence.lastActivity.getTime());
            staleTimeouts.set(
              id,
              setTimeout(() => {
                setStatuses((current) => ({
                  ...current,
                  [id]: { ...current[id], status: 'offline' },
                }));
              }, Math.max(remaining, 0))
            );
          }
        },
        (error) => {
          console.error('[chat] error leyendo presencia', error);
        }
      );
    });

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
