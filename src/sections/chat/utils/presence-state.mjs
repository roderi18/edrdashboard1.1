export const MANUAL_PRESENCE_STATUSES = new Set(['always', 'busy']);

export const normalizeManualPresence = (status) =>
  MANUAL_PRESENCE_STATUSES.has(status) ? status : null;

export const presenceTimestampToMillis = (timestamp) => {
  if (!timestamp) return 0;
  if (typeof timestamp.toMillis === 'function') return timestamp.toMillis();

  const time = new Date(timestamp).getTime();
  return Number.isFinite(time) ? time : 0;
};

export const isFreshPresenceSession = (session, now, staleAfterMs) => {
  const updatedAt = presenceTimestampToMillis(
    session?.actualizadoEn ?? session?.actualizadoEnCliente ?? session?.updatedAt
  );

  return updatedAt > 0 && now - updatedAt <= staleAfterMs;
};

export const derivePresenceSnapshot = ({
  presence = {},
  now = Date.now(),
  staleAfterMs,
} = {}) => {
  const sessions = Object.values(presence.sesiones ?? {});
  const activeSessions = sessions.filter((session) =>
    isFreshPresenceSession(session, now, staleAfterMs)
  );
  const latestSessionMs = activeSessions.reduce(
    (latest, session) =>
      Math.max(
        latest,
        presenceTimestampToMillis(
          session?.actualizadoEn ?? session?.actualizadoEnCliente ?? session?.updatedAt
        )
      ),
    0
  );

  if (activeSessions.length) {
    const manualStatus = normalizeManualPresence(presence.estadoManual);

    return {
      status:
        manualStatus || (activeSessions.some((session) => session.visible) ? 'online' : 'always'),
      lastActivity: new Date(latestSessionMs),
    };
  }

  // Compatibilidad temporal con clientes anteriores que escribían un único
  // estado en la raíz del documento.
  const legacyUpdatedAt = presenceTimestampToMillis(presence.actualizadoEn);

  if (presence.estado && legacyUpdatedAt && now - legacyUpdatedAt <= staleAfterMs) {
    return {
      status: presence.estado,
      lastActivity: new Date(legacyUpdatedAt),
    };
  }

  const lastActivityMs = Math.max(latestSessionMs, legacyUpdatedAt);

  return {
    status: 'offline',
    lastActivity: lastActivityMs ? new Date(lastActivityMs) : null,
  };
};
