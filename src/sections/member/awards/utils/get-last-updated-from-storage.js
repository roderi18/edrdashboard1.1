import { getAwardsProgressCache } from 'src/services/awards-progress-cache';

export function getLastUpdatedFromStorage(memberId, scope) {
    if (!memberId) return null;

    const data = getAwardsProgressCache(memberId).data || {};

    let latest = null;

    const collectLatest = (obj) => {
        if (!obj || typeof obj !== 'object') return;

        if (obj.updatedAt) {
            const d = new Date(obj.updatedAt);
            if (!latest || d > latest) latest = d;
        }

        Object.values(obj).forEach(collectLatest);
    };

    // ROOTS
    if (scope === 'academia-ministerial') {
        collectLatest(data.academia);
    }

    if (scope === 'sistema-de-ascenso') {
        collectLatest(data.sistemaAscenso);
    }

    // SUBCARPETAS DIRECTAS
    collectLatest(data.academia?.[scope]);
    collectLatest(data.sistemaAscenso?.[scope]);

    // SISTEMA DE ASCENSO PROFUNDO (nivel 3)
    if (data.sistemaAscenso) {
        Object.values(data.sistemaAscenso).forEach((section) => {
            if (!section || typeof section !== 'object') return;

            Object.entries(section).forEach(([parentId, parentValue]) => {
                if (parentId === scope) {
                    collectLatest(parentValue);
                }
            });
        });
    }

    return latest;
}
