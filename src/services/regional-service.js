import { obtenerFotosPrincipalesPorEntidad } from 'src/utils/firebase-photos';
import { getStorageCollection, setStorageCollection } from 'src/utils/storage-service';

const REGIONALS_STORAGE_KEY = 'regionals';

function mapApiRegionalToUI(regional) {
    return {
        id: String(regional.idRegion || regional.id),

        regionalName: regional.nombre || '',
        name: regional.nombre,
        regionId: String(regional.idRegion || regional.id),
        countryId: String(regional.idPais || regional.countryId || ''),
        idPais: regional.idPais || regional.countryId || null,
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

export const getCachedRegionals = () => getStorageCollection(REGIONALS_STORAGE_KEY) || [];

export const getRegionals = async () => {
    try {
        const res = await fetch('/api/regional');

        if (!res.ok) {
            await res.text();
            throw new Error('Error al obtener regionales');
        }

        const response = await res.json();

        const data = response.data || response.Data || [];
        const mappedRegionals = Array.isArray(data) ? data.map(mapApiRegionalToUI) : [];
        const photosByRegionalId = await obtenerFotosPrincipalesPorEntidad({ tipoEntidad: 'region' });

        const resolvedRegionals = mappedRegionals.map((regional) => ({
            ...regional,
            avatarUrl: photosByRegionalId[String(regional.id)]?.urlFoto || regional.avatarUrl || null,
        }));

        setStorageCollection(REGIONALS_STORAGE_KEY, resolvedRegionals);

        return resolvedRegionals;
    } catch (error) {
        console.error('getRegionals error:', error);
        return getCachedRegionals();
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
    const res = await fetch(`/api/regional?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
    });
    const text = await res.text();

    if (!res.ok) {
        throw new Error(text || `Error eliminando regional (${res.status})`);
    }

    if (!text) return {};

    try {
        return JSON.parse(text);
    } catch {
        return { raw: text };
    }
};
