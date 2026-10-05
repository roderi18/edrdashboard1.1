export const MANUAL_PRESENCE_STATUSES = new Set(['always', 'busy']);

export const chunkPresenceIds = (ids = [], chunkSize = 30) => {
  const normalizedSize = Number.isSafeInteger(chunkSize) && chunkSize > 0 ? chunkSize : 30;
  const chunks = [];

  for (let index = 0; index < ids.length; index += normalizedSize) {
    chunks.push(ids.slice(index, index + normalizedSize));
  }

  return chunks;
};

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

export const derivePresenceSnapshot = ({ presence = {}, now = Date.now(), staleAfterMs } = {}) => {
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

    // CONECTADO A LA APLICACION = EN LINEA, este la pestaña delante o detras.
    // Antes, con todas las pestañas ocultas pasaba a "Ausente" y el punto se
    // veia gris aunque la persona siguiera ahi. Solo cambia si ella misma elige
    // Ausente u Ocupado.
    return {
      status: manualStatus || 'online',
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

/**
 * LA PRESENCIA DE UN BUZON COMPARTIDO (Oficina Nacional, Tienda Virtual): en
 * linea si alguna de las personas que lo atienden tiene una sesion viva. Nadie
 * escribe la presencia del buzon (una persona nunca usa su numero): se deduce de
 * la de quienes lo atienden, que publican `atiende: ['oficina']` con la suya.
 */
export const derivePresenciaDeBuzon = ({
  presencias = [],
  now = Date.now(),
  staleAfterMs,
} = {}) => {
  const estados = presencias.map((presence) =>
    derivePresenceSnapshot({ presence, now, staleAfterMs })
  );
  const conectados = estados.filter((estado) => estado.status !== 'offline');
  const ultima = estados.reduce(
    (max, estado) => Math.max(max, estado.lastActivity ? estado.lastActivity.getTime() : 0),
    0
  );

  return {
    status: conectados.length ? 'online' : 'offline',
    lastActivity: ultima ? new Date(ultima) : null,
  };
};
