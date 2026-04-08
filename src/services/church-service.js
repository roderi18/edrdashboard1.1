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

export const buildChurchPayload = (data) => ({
    idIglesia: 0,
    nombre: data?.churchName ?? '',
    pastor: data?.pastor ?? '',
    direccion: data?.address ?? '',
    correo: data?.correo ?? '',
    idSeccion: Number(data?.sectionId) || 0,
});

export const createChurchApi = async (data) => {
    const payload = buildChurchPayload(data);

    console.log('CHURCH PAYLOAD FINAL 👉', JSON.stringify(payload, null, 2));

    const res = await fetch('/api/churches/post', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });

    const text = await res.text();

    console.log('CHURCH STATUS 👉', res.status);
    console.log('CHURCH RESPONSE RAW 👉', text);

    if (!res.ok) {
        throw new Error(text || `Error creando iglesia (${res.status})`);
    }

    if (!text) return {};

    try {
        return JSON.parse(text);
    } catch {
        return { raw: text };
    }
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
        const text = await res.text();

        if (!text || text.startsWith('<')) {
            console.error('Respuesta inválida al obtener iglesias:', text);
            return [];
        }

        const data = JSON.parse(text);

        return Array.isArray(data?.Data)
            ? data.Data.map(mapApiChurchesToUI)
            : [];
    } catch (error) {
        console.error('Error cargando iglesias:', error);
        return [];
    }
};