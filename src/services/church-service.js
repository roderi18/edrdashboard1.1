import barriosData from 'src/data/barrios.json';
import provinciasData from 'src/data/provincias.json';
import municipiosData from 'src/data/municipios.json';

import { authHeaders } from './member-service';

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
        telefono: apiChurch.telefono ?? '',
        correo: apiChurch.correo ?? '',
        provinceId: apiChurch.idProvincia?.toString() ?? '',
        countryId: apiChurch.idPais?.toString() ?? '',
        idSeccion: idSeccion ? idSeccion.toString() : '',
        sectionalName: apiChurch.idSeccionNavigation?.nombre ?? '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
};

// Se envia LO QUE HAY en el formulario, sin rellenos.
//
// Antes este payload fabricaba lo que faltaba: "Iglesia sin nombre", "Pastor no
// especificado", "Dirección no especificada" y, lo mas peligroso, `idSeccion: 1`
// —que metia la iglesia en la primera seccion del pais sin avisar—. Ninguno de
// esos valores se distingue de un dato real hasta que alguien intenta usarlo.
//
// Ahora nombre, pastor, direccion y seccion son obligatorios en el formulario
// (ChurchSchema), asi que siempre llegan con contenido y no hacen falta
// sustitutos.
export const buildChurchPayload = (data) => ({
    nombre: data?.churchName?.trim() ?? '',
    pastor: data?.pastor?.trim() ?? '',
    telefono: data?.telefono?.trim() ?? '',
    direccion: [
        provinces?.find(p => String(p.id) === String(data?.provinceId))?.nombre,
        municipios?.find(m => String(m.id) === String(data?.municipioId))?.nombre,
        sectores?.find(s => String(s.id) === String(data?.sectorId))?.nombre,
        data?.street,
    ]
        .filter(Boolean)
        .join(', '),
    // El correo no es obligatorio, pero el backend no admite el campo vacio: se
    // deja el marcador con fecha, que al menos se ve a simple vista que lo es.
    correo:
        data?.correo?.trim() ||
        `nomail_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}_${new Date().toTimeString().slice(0, 8).replace(/:/g, '')}@mail.com`,
    idSeccion: Number(data?.sectionId || data?.idSeccion) || null,
});

export const createChurchApi = async (data) => {
    const payload = buildChurchPayload(data);


    const res = await fetch('/api/churches/post', {
        method: 'POST',
        headers: await authHeaders({ 'Content-Type': 'application/json', Accept: 'application/json, text/plain, */*' }),
        body: JSON.stringify(payload),
        cache: 'no-store',
    });

    const text = await res.text();


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

export const updateChurchApi = async (data) => {
    const payload = buildChurchPayload(data);
    const res = await fetch('/api/churches/put', {
        method: 'PUT',
        headers: await authHeaders({ 'Content-Type': 'application/json', Accept: 'application/json, text/plain, */*' }),
        body: JSON.stringify({
            id: data?.id || data?.churchId,
            name: data?.churchName,
            pastor: data?.pastor,
            address: payload.direccion,
            // Correo y telefono los pone quien llama a partir del registro de la
            // iglesia. No se toman del formulario del destacamento: alli esos dos
            // campos son del destacamento, y enviarlos pisaba los de la iglesia.
            correo: data?.correo,
            telefono: data?.telefono,
            sectionId: data?.sectionId || data?.idSeccion,
        }),
        cache: 'no-store',
    });

    const text = await res.text();
    let parsed = null;

    try {
        parsed = text ? JSON.parse(text) : null;
    } catch {
        parsed = null;
    }

    if (!res.ok || parsed?.success === false) {
        throw new Error(
            parsed?.error || parsed?.Message || text || `Error actualizando iglesia (${res.status})`
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
            : Array.isArray(parsed?.data)
                ? parsed.data
                : Array.isArray(parsed?.Data)
                    ? parsed.Data
                    : [];

        return rows.map(mapApiChurchesToUI);
    } catch (error) {
        console.error('Error cargando iglesias:', error);
        return [];
    }
};
