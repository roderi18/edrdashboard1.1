import { obtenerFotosPrincipalesPorEntidad } from 'src/utils/firebase-photos';
import { getStorageCollection, setStorageCollection } from 'src/utils/storage-service';

const SECTIONALS_STORAGE_KEY = 'sectionals';

function mapApiSectionalToUI(sectional) {
    return {
        id: String(sectional.idSeccion || sectional.id),

        // 🔥 AGREGA ESTA LÍNEA
        idSeccion: String(sectional.idSeccion || sectional.id || ''),

        sectionalName: sectional.nombre || sectional.sectionalName || '',
        email: sectional.correo || sectional.email || '',

        regionalId: String(sectional.idRegion || sectional.regionalId || ''),

        directorId: sectional.idDirector ? String(sectional.idDirector) : '',

        avatarUrl: null,
        coverUrl: null,

        sectionalDestCount: sectional.sectionalDestCount || 0,
        sectionalXDestMemberCount: 0,
        // sectionalChurchCount: sectional.cantidadIglesias || 0,
        memberFullName: 'Desconocido',

        status: 'active',
    };
}

export const getCachedSectionals = () => getStorageCollection(SECTIONALS_STORAGE_KEY) || [];

export const getSectionals = async () => {
    try {
        const res = await fetch('/api/sectional');

        if (!res.ok) throw new Error('Error al obtener seccionales');

        const response = await res.json();

        const data = response.data || response.Data || response;

        const mappedSectionals = Array.isArray(data)
            ? data.map(mapApiSectionalToUI)
            : [];
        const photosBySectionalId = await obtenerFotosPrincipalesPorEntidad({ tipoEntidad: 'seccion' });

        const resolvedSectionals = mappedSectionals.map((sectional) => ({
            ...sectional,
            avatarUrl: photosBySectionalId[String(sectional.id)]?.urlFoto || sectional.avatarUrl || null,
        }));

        setStorageCollection(SECTIONALS_STORAGE_KEY, resolvedSectionals);

        return resolvedSectionals;
    } catch (error) {
        console.error('getSectionals error:', error);
        return getCachedSectionals();
    }
};

export const getSectionalById = async (id) => {
    const sectionals = await getSectionals();
    return sectionals.find((item) => item.id === id) || null;
};

export const getSectionalNameById = async (id) => {
    const sectional = await getSectionalById(id);
    return sectional?.sectionalName || 'Sección desconocida';
};

export const saveSectional = async (payload) => {
    const res = await fetch('/api/sectional/post', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });

    const data = await res.json();


    return data;
};

export const updateSectional = async (sectional) => {
    try {
        const res = await fetch('/api/sectional/put', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(sectional),
        });

        const text = await res.text();

        if (!text) return {};

        if (text.startsWith('<')) return {};

        return JSON.parse(text);
    } catch (error) {
        console.error('Error actualizando seccional:', error);
        return {};
    }
};

export const deleteSectional = async (id) => {
    const res = await fetch(`/api/sectional?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
    });
    const text = await res.text();

    if (!res.ok) {
        throw new Error(text || `Error eliminando seccional (${res.status})`);
    }

    if (!text) return {};

    try {
        return JSON.parse(text);
    } catch {
        return { raw: text };
    }
};
