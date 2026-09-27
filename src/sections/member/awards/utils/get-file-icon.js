export const FILE_ICON_CONFIG = {
    fundamentos: {
        src: '/sistemaAscenso/Academia Ministerial/fundamentos.webp',
        size: 40,
    },
    mentores: {
        src: '/sistemaAscenso/Academia Ministerial/mentores.webp',
        size: 40,
    },
    'seguridad-y-primeros-auxilios': {
        src: '/sistemaAscenso/Academia Ministerial/seguridad.webp',
        size: 40,
    },
    'destacamento-de-clase-mundial': {
        src: '/sistemaAscenso/Academia Ministerial/dcm.webp',
        size: 40,
    },
    'campamento-nacional-ministerial': {
        src: '/sistemaAscenso/Academia Ministerial/cnm.webp',
        size: 40,
    },
    'campamento-de-barras-doradas': {
        src: '/sistemaAscenso/Academia Ministerial/cbd.webp',
        size: 40,
    },
    'cuadro-avanzado': {
        src: '/sistemaAscenso/Academia Ministerial/cuadro-avanzado.webp',
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
