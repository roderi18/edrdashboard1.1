import {
    getStorageCollection,
    saveItem,
    setStorageCollection,
} from 'src/utils/storage-service';

// ------------------------------------------------------------
// DESTS
// ------------------------------------------------------------

export function saveDest(dest) {
    saveItem('dests', dest);
}

export function getDests() {
    return getStorageCollection('dests') || [];
}

export function getDestById(id) {
    const dests = getDests();
    return dests.find((d) => d.id === id);
}