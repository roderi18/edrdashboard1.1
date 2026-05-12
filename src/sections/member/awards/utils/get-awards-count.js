export function getTotalAwards(rootFolderId, items = []) {

    const root = items.find((i) => i.id === rootFolderId);

    // ❌ si no existe
    if (!root) return 0;

    // ❌ si NO es folder, no debe contar nada
    if (root.type !== 'folder') return 0;

    const folderIds = new Set([rootFolderId]);

    // 🔁 recorrer SOLO carpetas
    const walk = (parentId) => {
        items.forEach((item) => {
            if (item.type === 'folder' && item.parentId === parentId) {
                if (!folderIds.has(item.id)) {
                    folderIds.add(item.id);
                    walk(item.id);
                }
            }
        });
    };

    walk(rootFolderId);

    // ✅ contar SOLO archivos (no folders)
    return items.filter(
        (item) =>
            item.type !== 'folder' &&
            folderIds.has(item.parentId)
    ).length;
}

export function getCompletedAwards(memberId, folderId) {

    if (!memberId) return 0;
    if (typeof window === 'undefined') return 0;

    const key = `awards-status-${memberId}`;
    const saved = JSON.parse(localStorage.getItem(key) || '{}');

    const countRecursive = (node) => {
        let total = 0;
        Object.values(node || {}).forEach((v) => {
            if (v === 'completado') total += 1;
            else if (typeof v === 'object') total += countRecursive(v);
        });
        return total;
    };

    if (folderId === 'academia-ministerial') {
        return countRecursive(saved['academia']);
    }

    if (folderId === 'sistema-de-ascenso') {
        return countRecursive(saved['sistemaAscenso']);
    }


    const findNode = (node, path = 'root') => {
        if (!node || typeof node !== 'object') return null;

        if (node[folderId]) {
            return node[folderId];
        }

        for (const k in node) {
            const found = findNode(node[k], `${path}.${k}`);
            if (found) return found;
        }

        return null;
    };


    const node = findNode(saved);


    return node ? countRecursive(node) : 0;


}
