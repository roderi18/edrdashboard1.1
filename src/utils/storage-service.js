// Espejo en memoria de las colecciones de localStorage: evita re-parsear el
// JSON completo en cada lectura (las filas de tabla leen colecciones enteras
// por render). El evento 'storage' invalida la entrada cuando otra pestana
// escribe, conservando el comportamiento cross-tab anterior.

const memoryCache = new Map();

let storageListenerReady = false;

const ensureStorageListener = () => {
    if (storageListenerReady || typeof window === 'undefined') return;

    storageListenerReady = true;

    window.addEventListener('storage', (event) => {
        if (event.key === null) {
            memoryCache.clear();
        } else {
            memoryCache.delete(event.key);
        }
    });
};

export function getStorageCollection(key) {
    if (typeof window === 'undefined') return [];

    ensureStorageListener();

    let value;

    if (memoryCache.has(key)) {
        value = memoryCache.get(key);
    } else {
        const data = localStorage.getItem(key);
        value = data ? JSON.parse(data) : [];
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
    localStorage.setItem(key, JSON.stringify(data));
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
