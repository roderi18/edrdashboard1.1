import {
    getAwardsCacheKeys,
    writeAwardsJsonToCache,
    readAwardsJsonFromCache,
} from 'src/services/awards-progress-cache';

export function getAwardsKeys(memberId) {
    return getAwardsCacheKeys(memberId);
}

export function readJSON(key, fallback = {}) {
    return readAwardsJsonFromCache(key, fallback);
}

export function writeJSON(key, value) {
    writeAwardsJsonToCache(key, value);
}
