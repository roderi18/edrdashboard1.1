const STORAGE_KEY = 'regionals';

function mapApiRegionalToUI(regional) {
    return {
        id: String(regional.idRegion || regional.id),

        regionalName: regional.nombre || '',
        name: regional.nombre,
        regionId: regional.idRegion || regional.id,
        email: regional.correo || regional.email || '',

        avatarUrl: null,
        coverUrl: null,

        regionalXSectionalCount: 0,
        regionalXSectionalXDestCount: 0,
        regionalXSectionalMemberCount: 0,

        memberFullName: 'Desconocido',
        directorId: null,

        status: 'active',
    };
}


export const getRegionals = async () => {
    try {
        const res = await fetch('/api/regional');

        if (!res.ok) {
            const text = await res.text();
            console.log('ERROR API 👉', text);
            throw new Error('Error al obtener regionales');
        }

        const response = await res.json();

        const data = response.Data || [];
        console.log('DATA FINAL 👉', data);
        return Array.isArray(data) ? data.map(mapApiRegionalToUI) : [];
    } catch (error) {
        console.error('getRegionals error:', error);
        return [];
    }
};

export const saveRegional = (regional) => {
    if (typeof window === 'undefined') return regional;

    const stored = getRegionals();
    const updated = [...stored, regional];

    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

    return regional;
};

export const updateRegional = (updatedRegional) => {
    if (typeof window === 'undefined') return updatedRegional;

    const stored = getRegionals();
    const updated = stored.map((item) =>
        item.id === updatedRegional.id ? updatedRegional : item
    );

    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

    return updatedRegional;
};

export const deleteRegional = (regionalId) => {
    if (typeof window === 'undefined') return;

    const stored = getRegionals();
    const updated = stored.filter((item) => item.id !== regionalId);

    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
};