// Caché en memoria (por proceso) para las respuestas GetAll de la API externa
// systexploradores.somee.com, cuyo tier gratuito serializa la concurrencia y
// varía de ~0.3s a >17s por peticion. TTL corto + dedup de peticiones en vuelo
// + invalidación por clave desde las rutas de mutación, de modo que los flujos
// que releen datos justo despues de crear/editar sigan viendo datos frescos.
//
// Solo para route handlers (server-side).

const DEFAULT_TTL_MS = 60_000;

// NINGUNA espera es infinita. El upstream va de 0.3s a mas de 17s (lo dice la
// nota de arriba) y `fetch` no se rinde solo: una peticion lenta se llevaba por
// delante a quien la esperaba, incluida la resolucion de la sesion —el inicio se
// quedaba en "Verificando tu acceso" para siempre—.
//
// 9 segundos y no mas: las funciones de Netlify se cortan a los 10, asi que
// pasado ese punto la respuesta ya no llega igual. Mejor fallar nosotros, con un
// error que quien llama sabe manejar, que morir cortados por la plataforma.
const DEFAULT_TIMEOUT_MS = 9_000;

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
export async function fetchUpstreamText(
  key,
  url,
  { ttlMs = DEFAULT_TTL_MS, timeoutMs = DEFAULT_TIMEOUT_MS, init } = {}
) {
  const store = getStore();
  const now = Date.now();
  const entry = store.get(key);

  if (entry && entry.expiresAt > now) {
    return entry.promise;
  }

  const promise = (async () => {
    const controlador = new AbortController();
    const corte = setTimeout(() => controlador.abort(), timeoutMs);

    try {
      const res = await fetch(url, { ...init, signal: controlador.signal });
      const text = await res.text();

      return { ok: res.ok, status: res.status, text };
    } catch (error) {
      if (error?.name === 'AbortError') {
        throw new Error(`El servidor de datos no respondió en ${Math.round(timeoutMs / 1000)}s.`);
      }

      throw error;
    } finally {
      clearTimeout(corte);
    }
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
