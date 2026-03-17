'use client';

import { useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export function useAwardsFolderNavigation({ table, awardFolders }) {
    const router = useRouter();
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

        console.log('[Awards][hook] selected:', selectedItem);

        if (selectedItem?.type === 'folder') {
            router.push(`?folder=${selectedItem.id}`);
            table.onSelectAllRows(false, []);
        }
    }, [table.selected, awardFolders, router, table]);

    const openFolder = (folderId) => {
        router.push(`?folder=${folderId}`);
    };

    return {
        currentFolder,
        isInsideFolder,
        folderBreadcrumbs,
        openFolder,
    };
}
