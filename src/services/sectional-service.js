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

    console.log('RESPUESTA 👉', data);

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
    }
};

export const deleteSectional = async (id) => {
    try {
        await fetch(`/api/sectional?id=${id}`, {
            method: 'DELETE',
        });
    } catch (error) {
        console.error('Error eliminando seccional:', error);
    }
};