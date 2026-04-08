import {
    getStorageCollection,
    saveItem,
    setStorageCollection,
} from 'src/utils/storage-service';

// ------------------------------------------------------------
// DESTS
// ------------------------------------------------------------
export const mapApiDestToUI = (apiDest) => {
    return {
        id: apiDest.idDestacamento?.toString() || '',

        name: apiDest.nombre ?? '',
        destNumber: apiDest.numero ?? '',

        avatarUrl: apiDest.logo ?? null,

        coordinatorId: null,

        churchId: apiDest.idIglesia?.toString() ?? null,

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
    };
};

export function saveDest(dest) {
    saveItem('dests', dest);
}

export function getDestById(id) {
    const dests = getDests();
    return dests.find((d) => d.id === id);
}
const normalizeHoraReunion = (value) => {
    if (value == null) return null;
    const t = String(value).trim();
    if (!t) return null;
    if (/^\d{1,2}:\d{2}$/.test(t)) return `${t}:00`;
    return t;
};

export const buildDestPayload = (data) => ({
    idDestacamento: 0,
    nombre: data?.name?.trim() || 'name',
    idIglesia: Number(data.churchId) || (() => { throw new Error('idIglesia es requerido'); })(),
    correo: data?.correo?.trim() || 'test@test.com',
    telefono: data?.telefono?.trim() || '8090000000',

    direccion:
        data?.direccion?.trim() ||
        data?.address?.trim() ||
        'N/A',

    concilio: data?.concilio?.trim() || 'Asambleas',
    registradoOfnc: data?.registradoOfnc ?? true,
    rritrackActivo: data?.rritrackActivo ?? true,
    diaReunion: data?.destMeetingDays?.trim() || 'Sabado',
    horaReunion: data?.destMeetingTimes
        ? (data.destMeetingTimes.includes(':')
            ? (data.destMeetingTimes.length === 5
                ? `${data.destMeetingTimes}:00`
                : data.destMeetingTimes)
            : `${data.destMeetingTimes}:00:00`)
        : '14:00:00',
    logo: data?.logo?.trim() || '',
    numero: data?.destNumber?.trim() || '18',
    fechaInicio:
        data?.fechaInicio ||
        new Date().toISOString().split('T')[0],
});

export const createDestApi = async (data) => {
    const payload = buildDestPayload(data);
    console.log('DEST PAYLOAD FINAL 👉', JSON.stringify(payload, null, 2));

    const res = await fetch('/api/dest/post', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });

    const text = await res.text();

    console.log('DEST STATUS 👉', res.status);
    console.log('DEST RESPONSE RAW 👉', text);

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