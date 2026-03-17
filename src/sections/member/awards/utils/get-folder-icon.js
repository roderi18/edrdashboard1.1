export const FOLDER_ICON_CONFIG = {
    'academia-ministerial': {
        src: '/icons/academia-ministerial.png',
        size: 42,
    },
    'sistema-de-ascenso': {
        src: '/icons/exploradores-del-rey.png',
        size: 42,
    },
    exploradores: {
        src: '/icons/exploradores.png',
        size: 40,
    },
    seguidores: {
        src: '/icons/seguidores.png',
        size: 40,
    },
    pioneros: {
        src: '/icons/pioneros.png',
        size: 40,
    },
    navegantes: {
        src: '/icons/navegantes.png',
        size: 40,
    },
    instructor: {
        src: '/icons/academia-ministerial.png',
        size: 40,
    },
    'lider-juvenil': {
        src: '/icons/ilj.png',
        size: 40,
    },
    'lider-de-destacamento': {
        src: '/icons/cuadro-avanzado.png',
        size: 36,
    },
    'lider-organizacional': {
        src: '/icons/lider-organizacional.png',
        size: 36,
    },
};

export function getFolderIcon({ id }) {
    if (!id) return null;

    const key = id.toLowerCase();
    return FOLDER_ICON_CONFIG[key] ?? null;
}

