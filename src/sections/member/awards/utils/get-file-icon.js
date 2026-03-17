export const FILE_ICON_CONFIG = {
    fundamentos: {
        src: '/icons/fundamentos.png',
        size: 40,
    },
    mentores: {
        src: '/icons/mentores.png',
        size: 40,
    },
    'seguridad-y-primeros-auxilios': {
        src: '/icons/seguridad.png',
        size: 40,
    },
    'destacamento-de-clase-mundial': {
        src: '/icons/dcm.png',
        size: 40,
    },
    'campamento-nacional-ministerial': {
        src: '/icons/cnm.png',
        size: 40,
    },
    'campamento-de-barras-doradas': {
        src: '/icons/cbd.png',
        size: 40,
    },
    'cuadro-avanzado': {
        src: '/icons/cuadro-avanzado.png',
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
