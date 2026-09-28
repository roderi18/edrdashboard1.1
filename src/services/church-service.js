import { leerConCache, invalidarLecturas, avisarAOtrasSesiones } from 'src/utils/cache-de-lecturas.mjs';

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


    const res = await fetch('/api/churches/post/', {
        method: 'POST',
        headers: await authHeaders({ 'Content-Type': 'application/json', Accept: 'application/json, text/plain, */*' }),
        body: JSON.stringify(payload),
        cache: 'no-store',
    });
    // Lo escrito deja vieja cualquier lectura guardada (regiones, listas, fotos...).
    invalidarLecturas();
    avisarAOtrasSesiones('iglesias:');

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

/**
 * Actualiza una iglesia con la dirección YA en texto ("Provincia, Municipio,
 * Sector, Calle"), como la manda la landing de registro. `updateChurchApi` la
 * arma desde los ids del formulario, que aquí no hay.
 *
 * El correo tiene que ser EL QUE YA TIENE: UpdateIglesia crea otra iglesia cuando
 * no lo reconoce. Quien llama no debe usarla con una iglesia sin correo.
 */
export const actualizarIglesiaConTexto = async ({ id, nombre, pastor, direccion, correo, telefono, idSeccion }) => {
    if (!String(correo || '').trim()) {
        throw new Error('La iglesia no tiene correo: actualizarla crearía otra.');
    }
    const res = await fetch('/api/churches/put/', {
        method: 'PUT',
        headers: await authHeaders({ 'Content-Type': 'application/json', Accept: 'application/json, text/plain, */*' }),
        body: JSON.stringify({ id, name: nombre, pastor, address: direccion, correo, telefono, sectionId: idSeccion }),
        cache: 'no-store',
    });
    invalidarLecturas();
    avisarAOtrasSesiones('iglesias:');
    const text = await res.text();
    let parsed = null;
    try {
        parsed = text ? JSON.parse(text) : null;
    } catch {
        parsed = null;
    }
    if (!res.ok || parsed?.success === false) {
        throw new Error(parsed?.error || parsed?.Message || text || `Error actualizando iglesia (${res.status})`);
    }
    return parsed;
};

/**
 * Crea una iglesia con la dirección ya en texto y devuelve su id. Es la salida
 * cuando UpdateIglesia de la API .NET falla (desde el 28/09/2026 responde 500 a
 * todo): se crea la iglesia con los datos buenos y el destacamento pasa a
 * apuntar a ella. Sin correo se inventa uno único (el backend no admite vacío).
 */
export const crearIglesiaConTexto = async ({ nombre, pastor, direccion, telefono, idSeccion, correo }) => {
    const correoUnico =
        String(correo || '').trim() ||
        `nomail_iglesia_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@mail.com`;
    const res = await fetch('/api/churches/post/', {
        method: 'POST',
        headers: await authHeaders({ 'Content-Type': 'application/json', Accept: 'application/json, text/plain, */*' }),
        body: JSON.stringify({ idIglesia: 0, nombre, pastor, telefono, direccion, correo: correoUnico, idSeccion }),
        cache: 'no-store',
    });
    invalidarLecturas();
    avisarAOtrasSesiones('iglesias:');
    if (!res.ok) throw new Error(`No se pudo crear la iglesia (${res.status}).`);
    // SetIglesia no devuelve el id: se busca por el correo, que es único.
    const lista = await fetch(`/api/churches/?t=${Date.now()}`, { cache: 'no-store' })
        .then((r) => r.json())
        .catch(() => null);
    const filas = Array.isArray(lista) ? lista : lista?.data || lista?.Data || [];
    const creada = filas.find((iglesia) => String(iglesia.correo) === correoUnico);
    if (!creada) throw new Error('La iglesia se creó pero no aparece en la lista.');
    return String(creada.idIglesia);
};

export const updateChurchApi = async (data) => {
    const payload = buildChurchPayload(data);
    const res = await fetch('/api/churches/put/', {
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
    // Lo escrito deja vieja cualquier lectura guardada (regiones, listas, fotos...).
    invalidarLecturas();
    avisarAOtrasSesiones('iglesias:');

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

// Lo leído se reparte desde la caché de lecturas (ver `cache-de-lecturas.mjs`).
// Una respuesta rota LANZA dentro de la lectura: devolver [] la guardaba como
// si no hubiera iglesias y se quedaba así para todas las pantallas.
export const getChurches = () =>
    leerConCache('iglesias:', leerIglesias).catch((error) => {
        console.error('Error cargando iglesias:', error);
        return [];
    });

async function leerIglesias() {
    const res = await fetch('/api/churches/', {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json, text/plain, */*',
        },
        // Sin `no-store`: la ruta responde con ETag y el navegador guarda la copia
        // para preguntar "¿sigue igual?" y recibir un 304 vacío si no cambió.
        cache: 'no-cache',
    });

    const text = await res.text();

    if (!text || text.startsWith('<')) {
        throw new Error(`Respuesta inválida al obtener iglesias: ${String(text).slice(0, 120)}`);
    }

    const parsed = JSON.parse(text);

    const rows = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.data)
            ? parsed.data
            : Array.isArray(parsed?.Data)
                ? parsed.Data
                : [];

    return rows.map(mapApiChurchesToUI);
}
