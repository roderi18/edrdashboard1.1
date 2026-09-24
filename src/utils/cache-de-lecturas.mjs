// ----------------------------------------------------------------------
// CACHE DE LECTURAS DE LOS NIVELES ORGANIZACIONALES (en memoria de la pestaña).
//
// Qué se rompía: cada pantalla y cada pestaña volvía a pedir regiones, secciones,
// destacamentos, iglesias, miembros, fotos y directivas, aunque se acabaran de
// leer. La API .NET tarda de 0,3 s a 17 s, así que volver a una pantalla ya vista
// enseñaba otra vez el esqueleto y la aplicación se sentía lenta.
//
// Cómo funciona (lectura "vieja mientras se relee"):
//   - Lo leído hace menos de `frescuraMs` se entrega tal cual, sin red.
//   - Lo más viejo también se entrega al momento, y se relee por detrás para la
//     siguiente vez.
//   - Dos pantallas que piden lo mismo a la vez comparten la misma petición.
//   - Toda escritura invalida lo suyo (`invalidarLecturas`); una lectura que
//     estaba en vuelo cuando se invalidó no se guarda, para no resucitar lo viejo.
//   - Un error no se guarda: la próxima llamada vuelve a intentarlo.
// ----------------------------------------------------------------------

export const FRESCURA_MS = 60_000;

const entradas = new Map();

// ----------------------------------------------------------------------
// LO QUE SOBREVIVE A CERRAR LA APLICACIÓN: SOLO LO QUE NO ES DE NADIE.
//
// Al reabrir la aplicación, las listas de la organización (regiones, secciones,
// destacamentos, iglesias), los diseños de los organigramas, el catálogo de la
// tienda y los fondos de la portada salen al momento desde el disco y se releen
// por detrás, como en cualquier red social. NADA con datos de personas va aquí:
// padrón, salud, tutores, historial, pedidos o recibos viven solo en memoria y
// se pierden al cerrar. Cerrar sesión borra también esto (`invalidarLecturas()`),
// y una cuenta distinta en el mismo navegador empieza de cero
// (`fijarDuenoDeLasLecturas`).
// ----------------------------------------------------------------------

export const PREFIJOS_PERSISTENTES = [
  'regiones:',
  'secciones:',
  'destacamentos:',
  'iglesias:',
  'directiva:diseno:',
  'tienda-productos:',
  'tienda-encabezado:',
  'principal-tarjeta:',
];

const EN_DISCO = 'edr-lectura:';
const CLAVE_DUENO = 'edr-lecturas-dueno';

const disco = () => {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
};

const esPersistente = (clave) => PREFIJOS_PERSISTENTES.some((prefijo) => clave.startsWith(prefijo));

const leerDeDisco = (clave) => {
  try {
    const texto = disco()?.getItem(`${EN_DISCO}${clave}`);
    if (!texto) return null;

    const { valor, leidoEn } = JSON.parse(texto);

    return { valor, leidoEn: Number(leidoEn) || 0 };
  } catch {
    return null;
  }
};

const escribirEnDisco = (clave, valor, leidoEn) => {
  try {
    disco()?.setItem(`${EN_DISCO}${clave}`, JSON.stringify({ valor, leidoEn }));
  } catch {
    // Cuota llena o almacenamiento bloqueado: se sigue solo en memoria.
  }
};

const borrarDeDisco = (prefijos) => {
  const almacen = disco();
  if (!almacen) return;

  try {
    const claves = [];

    for (let indice = 0; indice < almacen.length; indice += 1) {
      const clave = almacen.key(indice);

      if (clave?.startsWith(EN_DISCO)) claves.push(clave);
    }

    claves
      .filter((clave) => {
        const propia = clave.slice(EN_DISCO.length);
        return !prefijos.length || prefijos.some((prefijo) => propia.startsWith(prefijo));
      })
      .forEach((clave) => almacen.removeItem(clave));
  } catch {
    // Almacenamiento bloqueado: no hay nada que borrar.
  }
};

// La entrada de `clave`, hidratada desde el disco si es de las persistentes.
const entradaDe = (clave, { crear = false } = {}) => {
  if (!entradas.has(clave)) {
    const enDisco = esPersistente(clave) ? leerDeDisco(clave) : null;

    if (enDisco || crear) {
      entradas.set(clave, {
        valor: enDisco?.valor,
        tiene: Boolean(enDisco),
        leidoEn: enDisco?.leidoEn || 0,
        promesa: null,
      });
    }
  }

  return entradas.get(clave) || null;
};

// Copia superficial de las listas: quien llama suele ordenarlas o filtrarlas en
// el sitio, y eso ensuciaba la copia guardada para todas las demás pantallas.
const copia = (valor) => (Array.isArray(valor) ? valor.slice() : valor);

const lanzarLectura = (clave, entrada, leer) => {
  const promesa = Promise.resolve()
    .then(leer)
    .then((valor) => {
      // Invalidada mientras se leía: lo leído puede ser de antes de la escritura.
      if (entradas.get(clave) === entrada) {
        entrada.valor = valor;
        entrada.tiene = true;
        entrada.leidoEn = Date.now();

        if (esPersistente(clave)) escribirEnDisco(clave, valor, entrada.leidoEn);
      }

      return valor;
    })
    .finally(() => {
      if (entrada.promesa === promesa) entrada.promesa = null;
    });

  entrada.promesa = promesa;

  return promesa;
};

/**
 * Lee `clave` con `leer()` una sola vez y la reparte desde memoria después.
 * `leer` debe LANZAR ante un fallo (no devolver un valor de reserva): lo que
 * devuelve se guarda como bueno.
 */
export async function leerConCache(clave, leer, { frescuraMs = FRESCURA_MS } = {}) {
  const entrada = entradaDe(clave, { crear: true });

  if (entrada.tiene) {
    const vieja = Date.now() - entrada.leidoEn >= frescuraMs;

    if (vieja && !entrada.promesa) {
      // Por detrás: un fallo aquí no afecta a nadie, se queda lo que había.
      lanzarLectura(clave, entrada, leer).catch(() => {});
    }

    return copia(entrada.valor);
  }

  const promesa = entrada.promesa || lanzarLectura(clave, entrada, leer);

  return copia(await promesa);
}

/** Lo guardado para `clave` sin pedir nada, o `undefined`. Para pintar en el primer render. */
export function valorGuardado(clave) {
  const entrada = entradaDe(clave);

  return entrada?.tiene ? copia(entrada.valor) : undefined;
}

export function hayGuardado(clave) {
  return Boolean(entradaDe(clave)?.tiene);
}

/**
 * Olvida lo guardado cuyas claves empiezan por alguno de los prefijos. Sin
 * prefijos, lo olvida todo (una escritura que no se sabe a qué afecta).
 */
export function invalidarLecturas(...prefijos) {
  [...entradas.keys()].forEach((clave) => {
    if (!prefijos.length || prefijos.some((prefijo) => clave.startsWith(prefijo))) {
      entradas.delete(clave);
    }
  });

  borrarDeDisco(prefijos);
}

/**
 * De quién es lo guardado. Otra cuenta en el mismo navegador empieza de cero
 * (memoria y disco); la misma cuenta al reabrir conserva lo del disco. Sin
 * cuenta (sesión cerrada) solo se vacía la memoria: el disco lo vacía el cierre
 * de sesión.
 */
let duenoEnMemoria;

export function fijarDuenoDeLasLecturas(uid) {
  const dueno = uid || null;

  if (duenoEnMemoria !== undefined && duenoEnMemoria !== dueno) {
    entradas.clear();
  }

  duenoEnMemoria = dueno;

  if (!dueno) return;

  try {
    const almacen = disco();
    const anterior = almacen?.getItem(CLAVE_DUENO);

    if (anterior && anterior !== dueno) {
      entradas.clear();
      borrarDeDisco([]);
    }

    almacen?.setItem(CLAVE_DUENO, dueno);
  } catch {
    // Almacenamiento bloqueado: no hay disco que proteger.
  }
}

// ----------------------------------------------------------------------
// AVISAR A LAS DEMÁS SESIONES.
//
// Lo que uno escribe invalida su propia caché, pero los demás seguían viendo lo
// de antes hasta su siguiente visita. Quien escribe avisa (`avisarAOtrasSesiones`)
// y las demás sesiones olvidan esos prefijos y se releen solas. El canal real
// (Firestore) lo registra `src/lib/avisos-de-lecturas.js`; aquí solo el enchufe,
// para que este archivo siga sin depender de Firebase (y se pruebe con node).
// ----------------------------------------------------------------------

let avisador = null;

export const registrarAvisador = (funcion) => {
  avisador = funcion;
};

export function avisarAOtrasSesiones(...prefijos) {
  if (!prefijos.length) return;

  try {
    avisador?.(prefijos);
  } catch {
    // Avisar es un extra: si falla, cada sesión se pone al día en su próxima visita.
  }
}

// ----------------------------------------------------------------------
// ENVOLTORIOS PARA LOS SERVICIOS.
//
// `conCache` convierte una lectura en una lectura con caché: la clave es el
// nombre más sus argumentos. `conInvalidacion` hace que una escritura olvide lo
// guardado al terminar (salga bien o mal: un fallo a medias también pudo
// cambiar algo). Sin prefijos lo olvida todo; las escrituras muy frecuentes
// (analíticas, borradores) pasan sus prefijos para no vaciar la caché entera.
// `prefijosRemotos` es lo que se avisa a las demás sesiones: siempre concreto
// (el prefijo del servicio), nunca "todo", para no vaciar la caché de todos por
// cualquier cambio.
// ----------------------------------------------------------------------

const claveDeArgumentos = (argumentos) => {
  try {
    return JSON.stringify(argumentos);
  } catch {
    // Argumentos que no se pueden serializar: esa llamada va sin caché.
    return null;
  }
};

export const conCache =
  (nombre, leer, opciones) =>
  (...argumentos) => {
    const clave = claveDeArgumentos(argumentos);

    if (clave === null) return leer(...argumentos);

    return leerConCache(`${nombre}:${clave}`, () => leer(...argumentos), opciones);
  };

export const conInvalidacion =
  (escribir, prefijos = [], prefijosRemotos = prefijos) =>
  async (...argumentos) => {
    try {
      return await escribir(...argumentos);
    } finally {
      invalidarLecturas(...prefijos);
      avisarAOtrasSesiones(...prefijosRemotos);
    }
  };
