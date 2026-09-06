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
//
// EN LOCAL NO HAY TAL CORTE. Ese limite es de la plataforma, no del upstream, y
// aqui solo servia para tirar destacamentos y secciones cada vez que somee se
// ponia en sus 17s: la pantalla de Asistencia se quedaba sin estructura. El
// padron de miembros ya hacia esta misma excepcion en su ruta.
const DEFAULT_TIMEOUT_MS = process.env.NODE_ENV === 'development' ? 25_000 : 9_000;

// Cuanto se puede seguir sirviendo una respuesta ya vencida mientras se trae la
// nueva. Diez minutos: lo que se cachea aqui son listados de la organizacion
// —miembros, destacamentos, secciones—, que cambian pocas veces al dia y cuyas
// ediciones invalidan la entrada al instante.
const MAX_STALE_MS = 10 * 60_000;

// Refresco en segundo plano: nadie lo espera y un fallo no rompe nada, porque
// quien pregunto ya se fue con la respuesta anterior en la mano.
const refrescandose = new Set();

const refrescarPorDetras = (key, url, opciones) => {
  if (refrescandose.has(key)) return;

  refrescandose.add(key);

  fetchUpstreamText(key, url, { ...opciones, forzar: true })
    .catch(() => null)
    .finally(() => refrescandose.delete(key));
};

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
  { ttlMs = DEFAULT_TTL_MS, timeoutMs = DEFAULT_TIMEOUT_MS, init, forzar = false } = {}
) {
  const store = getStore();
  const now = Date.now();
  const entry = store.get(key);

  if (!forzar && entry && entry.expiresAt > now) {
    return entry.promise;
  }

  // VENCIDA PERO SERVIBLE: se devuelve lo de antes y se refresca por detras.
  //
  // Con solo 60 segundos de vida, casi todo inicio de sesion pagaba la descarga
  // entera del padron —2,3 segundos medidos— para resolver una sola cosa: con
  // que correo entra este miembro. Y un padron de hace un minuto responde eso
  // igual de bien que uno recien traido.
  //
  // No hay riesgo de quedarse con datos viejos donde importa: cada mutacion
  // llama a `invalidateUpstream`, que BORRA la entrada —y sin entrada no hay
  // nada rancio que servir, la siguiente lectura va al origen—.
  if (!forzar && entry?.resultado && entry.servibleHasta > now) {
    refrescarPorDetras(key, url, { ttlMs, timeoutMs, init });

    return entry.resultado;
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

  store.set(key, {
    promise,
    expiresAt: now + ttlMs,
    servibleHasta: now + ttlMs + MAX_STALE_MS,
    resultado: entry?.resultado ?? null,
  });

  // UN FALLO NO BORRA LO QUE YA FUNCIONABA.
  //
  // Antes, cualquier tropiezo del upstream —un 500 suyo, o los 9 segundos
  // agotados— borraba la entrada entera, incluida la ultima respuesta BUENA. Y
  // el tropiezo tipico ni siquiera lo espera nadie: es el refresco por detras
  // que arranca cuando la entrada vence. Con la entrada borrada, la peticion
  // siguiente ya no tenia nada rancio que servir y salia un 500; de ahi el
  // "Error al obtener seccionales" en pantalla con el upstream levantado un
  // segundo despues.
  //
  // Ahora se conserva la respuesta anterior con SU MISMA ventana de servible:
  // no se alarga ni un milisegundo, asi que un upstream caido de verdad deja de
  // servirse cuando le tocaba y no se queda pintando datos viejos para siempre.
  const conservarLoBueno = () => {
    if (entry?.resultado && entry.servibleHasta > Date.now()) {
      store.set(key, {
        promise: Promise.resolve(entry.resultado),
        // Vencida a proposito: la proxima lectura vuelve a intentar el origen.
        expiresAt: 0,
        servibleHasta: entry.servibleHasta,
        resultado: entry.resultado,
      });

      return true;
    }

    store.delete(key);

    return false;
  };

  try {
    const result = await promise;

    if (!result.ok) {
      // Un 500 del upstream tampoco se le pasa a quien llama si tenemos algo
      // bueno que darle: el cuerpo de error no es JSON y la ruta acabaria
      // devolviendo su propio 500.
      if (conservarLoBueno()) return entry.resultado;
    } else {
      store.set(key, {
        promise,
        expiresAt: Date.now() + ttlMs,
        servibleHasta: Date.now() + ttlMs + MAX_STALE_MS,
        resultado: result,
      });
    }

    return result;
  } catch (error) {
    if (conservarLoBueno()) return entry.resultado;

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
