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

export const buildDestPayload = (data) => ({
    obj: {
        idDestacamento: 0,
        nombre: data?.name ?? '',
        numero: data?.destNumber ?? '',
        idIglesia: data?.churchId ? Number(data.churchId) : 0,

        correo: data?.correo ?? '',
        telefono: data?.telefono ?? '',

        registradoOfnc: data?.registradoOfnc ?? true,
        rritrackActivo: data?.rritrackActivo ?? true,

        diaReunion: data?.destMeetingDays ?? '',
        horaReunion: data?.destMeetingTimes ?? null,

        logo: '',
    },
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

    let parsed = null;

    try {
        parsed = text ? JSON.parse(text) : null;
    } catch (e) {
        parsed = null;
    }

    if (!res.ok) {
        console.error('DEST STATUS 👉', res.status);
        console.error('DEST RESPONSE RAW 👉', text);
        throw new Error(text || `Error creando destacamento (${res.status})`);
    }

    return parsed ?? {};
};