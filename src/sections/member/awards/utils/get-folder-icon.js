export const FOLDER_ICON_CONFIG = {
    'academia-ministerial': {
        src: '/sistema-ascenso/academia-ministerial/academia-ministerial.webp',
        size: 42,
    },
    'sistema-de-ascenso': {
        src: '/sistema-ascenso/academia-ministerial/exploradores-del-rey.webp',
        size: 42,
    },
    exploradores: {
        src: '/sistema-ascenso/academia-ministerial/exploradores.webp',
        size: 40,
    },
    seguidores: {
        src: '/sistema-ascenso/academia-ministerial/seguidores.webp',
        size: 40,
    },
    pioneros: {
        src: '/sistema-ascenso/academia-ministerial/pioneros.webp',
        size: 40,
    },
    navegantes: {
        src: '/sistema-ascenso/academia-ministerial/navegantes.webp',
        size: 40,
    },
    instructor: {
        src: '/sistema-ascenso/academia-ministerial/academia-ministerial.webp',
        size: 40,
    },
    'lider-juvenil': {
        src: '/sistema-ascenso/academia-ministerial/ilj.webp',
        size: 40,
    },
    'lider-de-destacamento': {
        src: '/sistema-ascenso/academia-ministerial/cuadro-avanzado.webp',
        size: 36,
    },
    'lider-organizacional': {
        src: '/sistema-ascenso/academia-ministerial/lider-organizacional.webp',
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

