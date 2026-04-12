import dayjs from 'dayjs';

export const DEST_DEFAULT = {
    id: '',

    name: '',
    destNumber: '',

    avatarUrl: null,

    coordinatorId: null,

    churchId: null,

    country: '',

    destMeetingDays: '',
    destMeetingTimes: '',

    correo: '',
    telefono: '',

    registradoOfnc: true,
    rritrackActivo: false,

    membershipStatus: 'active',
    isVerified: true,

    createdAt: '',
    updatedAt: '',
};

export function createDest(data) {
    return {
        ...DEST_DEFAULT,

        id: data.id,

        name: data.name ?? '',
        destNumber: data.destNumber ?? '',
        telefono: data.telefono ?? '',
        avatarUrl: data.avatarUrl ?? null,

        coordinatorId: data.coordinatorId ?? null,

        churchId: data.churchId ?? null,

        destMeetingTimes: data.destMeetingTimes ?? '',
        destMeetingDays: data.destMeetingDays ?? '',

        registradoOfnc: data.registradoOfnc ?? true,
        rritrackActivo: data.rritrackActivo ?? false,

        membershipStatus: data.membershipStatus ?? 'active',
        isVerified: data.isVerified ?? true,

        createdAt: data.createdAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
}