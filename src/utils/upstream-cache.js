// Caché en memoria (por proceso) para las respuestas GetAll de la API externa
// systexploradores.somee.com, cuyo tier gratuito serializa la concurrencia y
// varía de ~0.3s a >17s por peticion. TTL corto + dedup de peticiones en vuelo
// + invalidación por clave desde las rutas de mutación, de modo que los flujos
// que releen datos justo despues de crear/editar sigan viendo datos frescos.
//
// Solo para route handlers (server-side).

const DEFAULT_TTL_MS = 60_000;

// globalThis para sobrevivir el hot-reload del dev server sin duplicar cachés.
const getStore = () => {
  if (!globalThis.__upstreamTextCache) {
    globalThis.__upstreamTextCache = new Map();
  }

  return globalThis.__upstreamTextCache;
};

export const UPSTREAM_KEYS = {
  miembros: 'somee:miembros',
  destacamentos: 'somee:destacamentos',
  iglesias: 'somee:iglesias',
  secciones: 'somee:secciones',
  regiones: 'somee:regiones',
  cargos: 'somee:cargos',
  cargosMiembros: 'somee:cargos-miembros',
};

// Devuelve { ok, status, text } del upstream, cacheado por `key` durante
// `ttlMs`. Las peticiones concurrentes comparten la misma promesa y las
// respuestas no-ok no se cachean.
export async function fetchUpstreamText(key, url, { ttlMs = DEFAULT_TTL_MS, init } = {}) {
  const store = getStore();
  const now = Date.now();
  const entry = store.get(key);

  if (entry && entry.expiresAt > now) {
    return entry.promise;
  }

  const promise = (async () => {
    const res = await fetch(url, init);
    const text = await res.text();

    return { ok: res.ok, status: res.status, text };
  })();

  store.set(key, { promise, expiresAt: now + ttlMs });

  try {
    const result = await promise;

    if (!result.ok) {
      store.delete(key);
    }

    return result;
  } catch (error) {
    store.delete(key);
    throw error;
  }
}

// Invalida por PREFIJO: `invalidateUpstream('somee:miembros')` borra tanto la
// clave base como todas las variantes por usuario `somee:miembros:<hash>` (ver
// buildScopedUpstreamKey). Así una mutación limpia el caché de todos los alcances.
export function invalidateUpstream(...keys) {
  const store = getStore();

  if (!keys.length) {
    store.clear();
    return;
  }

  keys.forEach((prefix) => {
    for (const key of store.keys()) {
      if (key === prefix || key.startsWith(`${prefix}:`)) {
        store.delete(key);
      }
    }
  });
}

// Construye una clave de caché por-alcance a partir del token del llamante: el
// mismo usuario reutiliza su entrada; usuarios distintos nunca comparten caché
// (evita fugas de datos cuando el upstream filtra por identidad). Sin token usa
// una partición 'anon' separada.
export function buildScopedUpstreamKey(baseKey, authorizationHeader = '') {
  const token = String(authorizationHeader || '')
    .replace(/^Bearer\s+/i, '')
    .trim();

  if (!token) return `${baseKey}:anon`;

  // Hash corto y estable del token (no se guarda el token en claro).
  let hash = 0;
  for (let i = 0; i < token.length; i += 1) {
    hash = (hash * 31 + token.charCodeAt(i)) % 2147483647;
  }

  return `${baseKey}:${hash.toString(36)}`;
}
