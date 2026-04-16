const STORAGE_KEY = 'regionals';

function mapApiRegionalToUI(regional) {
    return {
        id: String(regional.idRegion || regional.id),

        regionalName: regional.nombre || '',
        name: regional.nombre,
        regionId: String(regional.idRegion || regional.id),
        email: regional.correo || regional.email || '',

        avatarUrl: null,
        coverUrl: null,

        regionalXSectionalCount: regional.regionalXSectionalCount || 0,
        regionalXSectionalXDestCount: regional.regionalXSectionalXDestCount || 0,
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
        return Array.isArray(data) ? data.map(mapApiRegionalToUI) : [];
    } catch (error) {
        console.error('getRegionals error:', error);
        return [];
    }
};

export const saveRegional = async (payload) => {
    const res = await fetch('/api/regional/post', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });

    const text = await res.text();

    if (!text || text.startsWith('<')) return {};

    return JSON.parse(text);
};

export const updateRegional = async (payload) => {
    const res = await fetch('/api/regional/put', {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });

    const text = await res.text();

    if (!text || text.startsWith('<')) return {};

    return JSON.parse(text);
};

export const deleteRegional = async (id) => {
    await fetch(`/api/regional?id=${id}`, {
        method: 'DELETE',
    });
};
