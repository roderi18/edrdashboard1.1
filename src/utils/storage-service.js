// Espejo en memoria de las colecciones de localStorage: evita re-parsear el
// JSON completo en cada lectura (las filas de tabla leen colecciones enteras
// por render). El evento 'storage' invalida la entrada cuando otra pestana
// escribe, conservando el comportamiento cross-tab anterior.

const memoryCache = new Map();

// DATOS PERSONALES, SOLO MIENTRAS DURA LA SESIÓN DE LA PESTAÑA.
//
// El padrón (teléfono, dirección, fecha de nacimiento, correo) se guardaba en
// `localStorage`, que no se borra nunca: en un teléfono compartido o perdido lo
// leía el siguiente que abriera el navegador, aunque se hubiera cerrado sesión.
// Estas claves van a `sessionStorage`, que se borra al cerrar la pestaña o la
// aplicación, y `borrarDatosDeSesion` las vacía al cerrar sesión. Las listas sin
// datos personales (regiones, secciones, destacamentos) siguen en `localStorage`
// para que la aplicación abra al momento.
export const CLAVES_DE_SESION = new Set(['members', 'leadershipAssignments']);

const almacenDe = (key) => (CLAVES_DE_SESION.has(key) ? sessionStorage : localStorage);

let storageListenerReady = false;

const ensureStorageListener = () => {
    if (storageListenerReady || typeof window === 'undefined') return;

    storageListenerReady = true;

    // Las copias que quedaron en `localStorage` de antes de este cambio se
    // borran la primera vez: eran justo los datos que no deben quedarse.
    CLAVES_DE_SESION.forEach((key) => {
        try {
            localStorage.removeItem(key);
        } catch {
            // Almacenamiento bloqueado: no hay nada que borrar.
        }
    });

    window.addEventListener('storage', (event) => {
        if (event.key === null) {
            memoryCache.clear();
        } else {
            memoryCache.delete(event.key);
        }
    });
};

// Lee y parsea una coleccion tolerando datos corruptos. Estas colecciones son un
// ESPEJO local de lo que devuelve el servidor (no la fuente de verdad), asi que
// ante un JSON invalido o un valor que no sea arreglo se descarta la entrada y se
// devuelve una coleccion vacia: la proxima sincronizacion la repuebla. Sin esto,
// un unico caracter corrupto en localStorage propagaba la excepcion y dejaba la
// aplicacion en blanco, sin forma de recuperarse desde la interfaz.
const readAndParse = (key) => {
    let raw;

    try {
        raw = almacenDe(key).getItem(key);
    } catch {
        // Modo privado o almacenamiento bloqueado por el navegador.
        return [];
    }

    if (!raw) return [];

    try {
        const parsed = JSON.parse(raw);

        if (!Array.isArray(parsed)) {
            console.warn(`[storage] "${key}" no contenia un arreglo; se descarta.`);
            return [];
        }

        return parsed;
    } catch (error) {
        console.warn(`[storage] "${key}" tenia un JSON invalido; se descarta.`, error);

        try {
            almacenDe(key).removeItem(key);
        } catch {
            // Si tampoco se puede limpiar, basta con devolver la coleccion vacia.
        }

        return [];
    }
};

export function getStorageCollection(key) {
    if (typeof window === 'undefined') return [];

    ensureStorageListener();

    let value;

    if (memoryCache.has(key)) {
        value = memoryCache.get(key);
    } else {
        value = readAndParse(key);
        memoryCache.set(key, value);
    }

    // Copia superficial: los callers pueden mutar el arreglo devuelto (sort,
    // splice) sin contaminar el espejo, igual que cuando cada lectura
    // re-parseaba el JSON.
    return Array.isArray(value) ? value.slice() : value;
}

export function setStorageCollection(key, data) {
    if (typeof window === 'undefined') return;

    ensureStorageListener();

    memoryCache.set(key, data);

    try {
        almacenDe(key).setItem(key, JSON.stringify(data));
    } catch (error) {
        // Cuota agotada o almacenamiento bloqueado (modo privado). El espejo en
        // memoria ya quedo actualizado, asi que la sesion actual sigue funcionando;
        // solo se pierde la persistencia entre recargas.
        console.warn(`[storage] no se pudo persistir "${key}".`, error);
    }
}

export function saveItem(key, item) {
    const collection = getStorageCollection(key);

    const index = collection.findIndex((i) => i.id === item.id);

    if (index >= 0) {
        collection[index] = item;
    } else {
        collection.push(item);
    }

    setStorageCollection(key, collection);

    return collection;
}

export function deleteItem(key, id) {
    const collection = getStorageCollection(key);

    const updated = collection.filter((i) => i.id !== id);

    setStorageCollection(key, updated);

    return updated;
}

/** Al cerrar sesión: fuera los datos personales de memoria y de `sessionStorage`. */
export function borrarDatosDeSesion() {
    if (typeof window === 'undefined') return;

    CLAVES_DE_SESION.forEach((key) => {
        memoryCache.delete(key);

        try {
            sessionStorage.removeItem(key);
            localStorage.removeItem(key);
        } catch {
            // Almacenamiento bloqueado: no hay nada que borrar.
        }
    });
}
