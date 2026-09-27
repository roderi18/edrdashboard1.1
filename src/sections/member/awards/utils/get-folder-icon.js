export const FOLDER_ICON_CONFIG = {
    'academia-ministerial': {
        src: '/sistemaAscenso/Academia Ministerial/academia-ministerial.webp',
        size: 42,
    },
    'sistema-de-ascenso': {
        src: '/sistemaAscenso/Academia Ministerial/exploradores-del-rey.webp',
        size: 42,
    },
    exploradores: {
        src: '/sistemaAscenso/Academia Ministerial/exploradores.webp',
        size: 40,
    },
    seguidores: {
        src: '/sistemaAscenso/Academia Ministerial/seguidores.webp',
        size: 40,
    },
    pioneros: {
        src: '/sistemaAscenso/Academia Ministerial/pioneros.webp',
        size: 40,
    },
    navegantes: {
        src: '/sistemaAscenso/Academia Ministerial/navegantes.webp',
        size: 40,
    },
    instructor: {
        src: '/sistemaAscenso/Academia Ministerial/academia-ministerial.webp',
        size: 40,
    },
    'lider-juvenil': {
        src: '/sistemaAscenso/Academia Ministerial/ilj.webp',
        size: 40,
    },
    'lider-de-destacamento': {
        src: '/sistemaAscenso/Academia Ministerial/cuadro-avanzado.webp',
        size: 36,
    },
    'lider-organizacional': {
        src: '/sistemaAscenso/Academia Ministerial/lider-organizacional.webp',
        size: 36,
    },
};

export function getFolderIcon({ id, imagenUrl }) {
    // Las carpetas añadidas desde la aplicación traen su imagen.
    if (imagenUrl) return { src: imagenUrl, size: 36 };
    if (!id) return null;

    const key = id.toLowerCase();
    return FOLDER_ICON_CONFIG[key] ?? null;
}

