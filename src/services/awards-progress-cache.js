const awardsProgressCache = new Map();

const createEmptyState = () => ({ status: {}, data: {} });

export const getAwardsProgressCache = (idMiembro) => {
  if (!idMiembro) return createEmptyState();

  const cached = awardsProgressCache.get(String(idMiembro));

  return cached || createEmptyState();
};

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
