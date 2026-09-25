const awardsProgressCache = new Map();

const createEmptyState = () => ({ status: {}, data: {} });

export const getAwardsProgressCache = (idMiembro) => {
  if (!idMiembro) return createEmptyState();

  const cached = awardsProgressCache.get(String(idMiembro));

  return cached || createEmptyState();
};

// Si ya se leyó el progreso de este miembro en la sesión: con él la pestaña se
// pinta al momento; sin él, esqueleto hasta la primera lectura (y no ceros que
// luego saltan a la cifra real).
export const hayProgresoEnCache = (idMiembro) =>
  Boolean(idMiembro) && awardsProgressCache.has(String(idMiembro));

// Al cerrar sesión: el progreso es de personas y vive solo en memoria, pero
// sin recarga seguiría ahí para la siguiente cuenta.
export const vaciarProgresoEnCache = () => awardsProgressCache.clear();

export const setAwardsProgressCache = (idMiembro, nextState = {}) => {
  if (!idMiembro) return createEmptyState();

  const current = getAwardsProgressCache(idMiembro);
  const value = {
    status: nextState.status || current.status || {},
    data: nextState.data || current.data || {},
  };

  awardsProgressCache.set(String(idMiembro), value);

  return value;
};

export const getAwardsCacheKeys = (idMiembro) => ({
  statusKey: `awards-status-${idMiembro}`,
  dataKey: `awards-data-${idMiembro}`,
});

export const getMemberIdFromAwardsKey = (key = '') => {
  const match = String(key).match(/^awards-(?:status|data)-(.+)$/);

  return match?.[1] || '';
};

export const readAwardsJsonFromCache = (key, fallback = {}) => {
  const idMiembro = getMemberIdFromAwardsKey(key);
  const cache = getAwardsProgressCache(idMiembro);

  if (String(key).startsWith('awards-status-')) return cache.status || fallback;
  if (String(key).startsWith('awards-data-')) return cache.data || fallback;

  return fallback;
};

export const writeAwardsJsonToCache = (key, value) => {
  const idMiembro = getMemberIdFromAwardsKey(key);
  const cache = getAwardsProgressCache(idMiembro);

  if (String(key).startsWith('awards-status-')) {
    return setAwardsProgressCache(idMiembro, { ...cache, status: value });
  }

  if (String(key).startsWith('awards-data-')) {
    return setAwardsProgressCache(idMiembro, { ...cache, data: value });
  }

  return cache;
};

export const notifyAwardsProgressChanged = (idMiembro) => {
  if (typeof window === 'undefined') return;

  window.dispatchEvent(new CustomEvent('awards-status-changed', { detail: { memberId: idMiembro } }));
};
