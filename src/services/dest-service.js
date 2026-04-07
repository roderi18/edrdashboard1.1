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

export const buildDestPayload = (data, id = 0) => ({
    obj: {
        idDestacamento: id,
        nombre: data.name,
        numero: data.destNumber,
        idIglesia: Number(data.churchId) || null,

        correo: data.correo || '',
        telefono: data.telefono || '',

        registradoOfnc: data.registradoOfnc ?? true,
        rritrackActivo: data.rritrackActivo ?? true,

        diaReunion: data.destMeetingDays || '',
        horaReunion: data.destMeetingTimes || null,

        logo: '',
    },
});

export const createDestApi = async (data) => {
    const res = await fetch('/api/dest/post', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(buildDestPayload(data)),
    });

    const text = await res.text();

    if (!text) return {};

    try {
        return JSON.parse(text);
    } catch (e) {
        console.error('Respuesta no es JSON 👉', text);
        return {};
    }
};