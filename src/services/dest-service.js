import { obtenerFotosPrincipalesPorEntidad } from 'src/utils/firebase-photos';
import {
    saveItem,
    getStorageCollection,
} from 'src/utils/storage-service';

const DESTS_STORAGE_KEY = 'dests';
// ------------------------------------------------------------
// DESTS
// ------------------------------------------------------------

const normalizePhoneToE164 = (value) => {
    const phone = String(value ?? '').trim();

    if (!phone) return '';
    if (phone.startsWith('+')) return phone;

    const digits = phone.replace(/\D/g, '');

    if (digits.length === 10) return `+1${digits}`;
    if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;

    return phone;
};

export const mapApiDestToUI = (apiDest) => ({
        id: apiDest.idDestacamento ? String(apiDest.idDestacamento) : null,

        name: apiDest.nombre ?? '',
        destNumber: apiDest.numero ?? '',

        avatarUrl: apiDest.logo ?? null,

        coordinatorId: null,

        churchId: apiDest.idIglesia?.toString() ?? null,

        correo: apiDest.correo ?? '',
        telefono: normalizePhoneToE164(apiDest.telefono),
        direccion: apiDest.direccion ?? '',
        concilio: apiDest.concilio ?? '',
        fechaInicio: apiDest.fechaInicio ?? '',
        registradoOfnc: apiDest.registradoOfnc ?? true,
        rritrackActivo: apiDest.rritrackActivo ?? false,

        country: '',

        destMeetingDays: apiDest.diaReunion ?? '',
        destMeetingTimes: apiDest.horaReunion ?? '',

        membershipStatus:
            apiDest.registradoOfnc === null
                ? 'active'
                : apiDest.registradoOfnc
                    ? 'active'
                    : 'banned',

        isVerified: apiDest.rritrackActivo ?? true,

        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    });
export function saveDest(dest) {
    saveItem(DESTS_STORAGE_KEY, dest);
}

export function getDests() {
    return getStorageCollection(DESTS_STORAGE_KEY) || [];
}

export async function getDestsApi() {
    try {
        const res = await fetch('/api/dest');

        const text = await res.text();

        let parsed;
        try {
            parsed = JSON.parse(text);
        } catch {
            console.error('❌ DEST NO JSON:', text);
            return [];
        }

        const data = parsed?.data || parsed?.Data || parsed;
        const mappedDests = Array.isArray(data)
            ? data.map(mapApiDestToUI)
            : [];
        const photosByDestId = await obtenerFotosPrincipalesPorEntidad({ tipoEntidad: 'destacamento' });
        const localDests = getDests();
        const localDestsById = new Map(
            localDests
                .filter((dest) => dest?.id)
                .map((dest) => [String(dest.id), dest])
        );

        return mappedDests.map((dest) => {
            const localDest = localDestsById.get(String(dest.id));

            return {
                ...dest,
                coordinatorId: localDest?.coordinatorId ?? dest.coordinatorId ?? null,
                avatarUrl:
                    photosByDestId[String(dest.id)]?.urlFoto ||
                    localDest?.avatarUrl ||
                    dest.avatarUrl ||
                    null,
            };
        });
    } catch (error) {
        console.error('❌ ERROR DEST API:', error);
        return [];
    }
}

export function getDestById(id) {
    const dests = getDests();
    return dests.find((d) => d.id === id);
}

const normalizePhoneForApi = (value) => String(value ?? '').replace(/\D/g, '');

const normalizeDateTimeForApi = (value) => {
    if (!value) return new Date().toISOString().slice(0, 19);

    return String(value).replace('Z', '').split('.')[0];
};

export const buildDestPayload = (data) => ({
    idDestacamento: Number(data?.idDestacamento || data?.id || 0),
    nombre: data?.name?.trim() || 'name',
    idIglesia: Number(data.churchId) || (() => { throw new Error('idIglesia es requerido'); })(),
    correo:
        data?.correo?.trim() ||
        `nomail_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}_${new Date().toTimeString().slice(0, 8).replace(/:/g, '')}@mail.com`,
    telefono: normalizePhoneForApi(data?.telefono),

    direccion:
        data?.direccion?.trim() ||
        data?.address?.trim() ||
        'N/A',

    concilio: data?.concilio?.trim() || 'N/A',
    registradoOfnc: data?.registradoOfnc ?? null,
    rritrackActivo: data?.rritrackActivo ?? null,

    diaReunion: data?.destMeetingDays?.trim() || '',

    horaReunion: data?.destMeetingTimes
        ? (data.destMeetingTimes.includes(':')
            ? (data.destMeetingTimes.length === 5
                ? `${data.destMeetingTimes}:00`
                : data.destMeetingTimes)
            : `${data.destMeetingTimes}:00:00`)
        : '',

    logo: data?.logo?.trim() || '',

    numero: data?.destNumber?.trim() || '',

    fechaInicio: normalizeDateTimeForApi(data?.fechaInicio),
});

export const createDestApi = async (data) => {
    const payload = buildDestPayload(data);

    const res = await fetch('/api/dest/post', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });

    const text = await res.text();


    if (!res.ok) {
        throw new Error(text || `Error creando destacamento (${res.status})`);
    }

    if (!text) return {};

    try {
        return JSON.parse(text);
    } catch {
        return { raw: text };
    }
};

export const updateDestApi = async (data) => {
    const payload = buildDestPayload(data);

    const res = await fetch('/api/dest/put', {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });

    const text = await res.text();


    if (!res.ok) {
        throw new Error(text || `Error actualizando destacamento (${res.status})`);
    }

    if (!text) return {};

    try {
        return JSON.parse(text);
    } catch {
        return { raw: text };
    }
};

export const deleteDestApi = async (id) => {
    const res = await fetch(`/api/dest?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
    });
    const text = await res.text();

    if (!res.ok) {
        throw new Error(text || `Error eliminando destacamento (${res.status})`);
    }

    if (!text) return {};

    try {
        return JSON.parse(text);
    } catch {
        return { raw: text };
    }
};
