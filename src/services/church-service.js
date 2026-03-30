export const mapApiChurchesToUI = (apiChurch) => {
    return {
        id: apiChurch.idIglesia?.toString() || '',

        name: apiChurch.nombre ?? '',
        pastor: apiChurch.pastor ?? '',
        address: apiChurch.direccion ?? '',

        correo: apiChurch.correo ?? '',

        provinceId: apiChurch.idProvincia?.toString() ?? '',
        countryId: apiChurch.idPais?.toString() ?? '',

        sectionId: apiChurch.idSeccion?.toString() ?? '',
        sectionalName: apiChurch.idSeccionNavigation?.nombre ?? '',

        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
};

export const buildChurchPayload = (data, id = 0) => ({
    obj: {
        idIglesia: id,
        nombre: data.churchName,
        pastor: data.pastor,
        direccion: data.address,
        correo: data.correo || '',
        idSeccion: data.sectionId || null,
    },
});

export const createChurchApi = async (data) => {
    const res = await fetch('/api/churches/post', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            obj: {
                idIglesia: 0,
                nombre: data.churchName,
                pastor: data.pastor,
                direccion: data.address,
                correo: data.correo || '',
                idSeccion: data.sectionId || null,
            },
        }),
    });

    return res.json();
};

export const saveChurch = (church) => {
    const stored = JSON.parse(localStorage.getItem('churches') || '[]');

    const updated = [...stored, church];

    localStorage.setItem('churches', JSON.stringify(updated));

    return church;
};

export const getChurches = async () => {
    try {
        const res = await fetch('/api/churches');
        const data = await res.json();

        return Array.isArray(data?.Data)
            ? data.Data.map(mapApiChurchesToUI)
            : [];
    } catch (error) {
        console.error('Error cargando iglesias:', error);
        return [];
    }
};