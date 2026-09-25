'use client';

import { useMemo, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

// Abrir una carpeta es cambiar `?folder=` en la misma página, y la página ya
// tiene todo el árbol en memoria. Con `router.push` Next pedía al servidor la
// página otra vez en cada clic (y en Netlify eso es una función que arranca):
// la carpeta tardaba en abrirse sin ninguna necesidad. `history.pushState` cambia
// la dirección al momento, `useSearchParams` se entera igual y el botón Atrás
// sigue funcionando.
export const irACarpeta = (folderId) => {
    if (typeof window === 'undefined') return;

    window.history.pushState(null, '', `?folder=${encodeURIComponent(folderId ?? '')}`);
};

export function useAwardsFolderNavigation({ table, awardFolders }) {
    const searchParams = useSearchParams();

    const currentFolder = searchParams.get('folder');
    const isInsideFolder = Boolean(currentFolder);

    // 🔹 Breadcrumbs de carpetas
    const folderBreadcrumbs = useMemo(() => {
        if (!currentFolder) return [];

        const crumbs = [];
        let folderId = currentFolder;

        while (folderId) {
            const folder = awardFolders.find((f) => f.id === folderId);
            if (!folder) break;

            crumbs.unshift({
                name: folder.name,
                id: folder.id,
                href: `?folder=${folder.id}`,
            });

            folderId = folder.parentId;
        }

        return crumbs;
    }, [currentFolder, awardFolders]);

    // 🔹 Al seleccionar una carpeta desde la tabla
    useEffect(() => {

        if (!table?.selected?.length) return;

        const selectedId = table.selected[0];
        const selectedItem = awardFolders.find((item) => item.id === selectedId);


        if (selectedItem?.type === 'folder') {
            irACarpeta(selectedItem.id);
            table.onSelectAllRows(false, []);
        }
    }, [table.selected, awardFolders, table]);

    const openFolder = (folderId) => {
        irACarpeta(folderId);
    };

    return {
        currentFolder,
        isInsideFolder,
        folderBreadcrumbs,
        openFolder,
    };
}
