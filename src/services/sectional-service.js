function mapApiSectionalToUI(sectional) {
    return {
        id: String(sectional.idSeccion || sectional.id),

        sectionalName: sectional.nombre || sectional.sectionalName || '',
        email: sectional.correo || sectional.email || '',

        regionalId: String(sectional.idRegion || sectional.regionalId || ''),

        directorId: sectional.idDirector || null,

        avatarUrl: null,
        coverUrl: null,

        sectionalDestCount: 0,
        sectionalXDestMemberCount: 0,

        memberFullName: 'Desconocido',

        status: 'active',
    };
}

const STORAGE_KEY = 'sectionals';

export const getSectionals = async () => {
    try {
        const res = await fetch('/api/sectional');

        if (!res.ok) throw new Error('Error al obtener seccionales');

        const response = await res.json();

        const data = response.Data || response.data || response;

        return Array.isArray(data)
            ? data.map(mapApiSectionalToUI)
            : [];
    } catch (error) {
        console.error('getSectionals error:', error);
        return [];
    }
};

export const getSectionalById = (id) => {
    const sectionals = getSectionals();
    return sectionals.find((item) => item.id === id) || null;
};

export const getSectionalNameById = (id) => {
    const sectional = getSectionalById(id);
    return sectional?.sectionalName || 'Sección desconocida';
};

export const saveSectional = (sectional) => {
    if (typeof window === 'undefined') return sectional;

    const stored = getSectionals();

    const exists = stored.some((item) => item.id === sectional.id);

    const updated = exists
        ? stored.map((item) =>
            item.id === sectional.id ? sectional : item
        )
        : [...stored, sectional];

    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

    return sectional;
};

export const updateSectional = (updatedSectional) => {
    if (typeof window === 'undefined') return updatedSectional;

    const stored = getSectionals();
    const updated = stored.map((item) =>
        item.id === updatedSectional.id ? updatedSectional : item
    );

    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

    return updatedSectional;
};

export const deleteSectional = (sectionalId) => {
    if (typeof window === 'undefined') return;

    const stored = getSectionals();
    const updated = stored.filter((item) => item.id !== sectionalId);

    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
};