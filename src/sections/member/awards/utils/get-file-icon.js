export const FILE_ICON_CONFIG = {
    fundamentos: {
        src: '/sistema-ascenso/academia-ministerial/fundamentos.webp',
        size: 40,
    },
    mentores: {
        src: '/sistema-ascenso/academia-ministerial/mentores.webp',
        size: 40,
    },
    'seguridad-y-primeros-auxilios': {
        src: '/sistema-ascenso/academia-ministerial/seguridad.webp',
        size: 40,
    },
    'destacamento-de-clase-mundial': {
        src: '/sistema-ascenso/academia-ministerial/dcm.webp',
        size: 40,
    },
    'campamento-nacional-ministerial': {
        src: '/sistema-ascenso/academia-ministerial/cnm.webp',
        size: 40,
    },
    'campamento-de-barras-doradas': {
        src: '/sistema-ascenso/academia-ministerial/cbd.webp',
        size: 40,
    },
    'cuadro-avanzado': {
        src: '/sistema-ascenso/academia-ministerial/cuadro-avanzado.webp',
        size: 34,
    },
};

export function getCustomFileIcon({ id }) {

    if (!id) return null;

    const key = id
        .toString()
        .toLowerCase()
        .replace(/\s+/g, '-');
    return FILE_ICON_CONFIG[key] ?? null;
}
