import provinciasData from 'src/data/provincias.json';
import municipiosData from 'src/data/municipios.json';
import barriosData from 'src/data/barrios.json';

const provinces = provinciasData;
const municipios = municipiosData.map((m, index) => ({
    ...m,
    id: index + 1,
    municipioId: index + 1,
}));
const sectores = barriosData;
export const mapApiChurchesToUI = (apiChurch) => {
    const idSeccion =
        apiChurch.idSeccion ??
        apiChurch.idseccion ??
        apiChurch.seccionId ??
        apiChurch.sectionId ??
        0;

    return {
        id: apiChurch.idIglesia?.toString() || '',
        name: apiChurch.nombre ?? '',
        pastor: apiChurch.pastor ?? '',
        address: apiChurch.direccion ?? '',
        correo: apiChurch.correo ?? '',
        provinceId: apiChurch.idProvincia?.toString() ?? '',
        countryId: apiChurch.idPais?.toString() ?? '',
        sectionId: idSeccion ? idSeccion.toString() : '',
        sectionalName: apiChurch.idSeccionNavigation?.nombre ?? '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
};

export const buildChurchPayload = (data) => ({
    nombre: data?.churchName?.trim() || 'Iglesia sin nombre',
    pastor: data?.pastor?.trim() || 'Pastor no especificado',
    direccion: [
        provinces?.find(p => String(p.id) === String(data?.provinceId))?.nombre,
        municipios?.find(m => String(m.id) === String(data?.municipioId))?.nombre,
        sectores?.find(s => String(s.id) === String(data?.sectorId))?.nombre,
        data?.street,
    ]
        .filter(Boolean)
        .join(', ') || 'Dirección no especificada',
    correo:
        data?.correo?.trim() ||
        `nomail_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}_${new Date().toTimeString().slice(0, 8).replace(/:/g, '')}@mail.com`,
    idSeccion: Number(data?.sectionId || data?.idSeccion || data?.sectionalName) || 1,
});

export const createChurchApi = async (data) => {
    const payload = buildChurchPayload(data);

    console.log('CHURCH PAYLOAD FINAL 👉', JSON.stringify(payload, null, 2));

    const res = await fetch('/api/churches/post', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json, text/plain, */*',
        },
        body: JSON.stringify(payload),
        cache: 'no-store',
    });

    const text = await res.text();

    console.log('CHURCH STATUS 👉', res.status);
    console.log('CHURCH RESPONSE RAW 👉', text);

    let parsed = null;

    try {
        parsed = text ? JSON.parse(text) : null;
    } catch {
        parsed = null;
    }

    if (!res.ok) {
        console.error('CHURCH PAYLOAD ERROR 👉', payload);
        throw new Error(
            parsed?.error || parsed?.Message || text || `Error creando iglesia (${res.status})`
        );
    }

    return parsed ?? { raw: text };
};

export const getChurches = async () => {
    try {
        const res = await fetch('/api/churches', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json, text/plain, */*',
            },
            cache: 'no-store',
        });

        const text = await res.text();

        if (!text || text.startsWith('<')) {
            console.error('Respuesta inválida al obtener iglesias:', text);
            return [];
        }

        let parsed = null;

        try {
            parsed = JSON.parse(text);
        } catch (error) {
            console.error('Error parseando iglesias:', error);
            return [];
        }

        const rows = Array.isArray(parsed)
            ? parsed
            : Array.isArray(parsed?.Data)
                ? parsed.Data
                : [];

        return rows.map(mapApiChurchesToUI);
    } catch (error) {
        console.error('Error cargando iglesias:', error);
        return [];
    }
};