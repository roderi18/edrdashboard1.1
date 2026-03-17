export function getStorageCollection(key) {
    if (typeof window === 'undefined') return [];

    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
}

export function setStorageCollection(key, data) {
    if (typeof window === 'undefined') return;

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