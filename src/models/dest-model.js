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
    rritrackActivo: true,

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

        avatarUrl: data.avatarUrl ?? null,

        coordinatorId: data.coordinatorId ?? null,

        churchId: data.churchId ?? null,

        destMeetingTimes: data.destMeetingTimes ?? '',
        destMeetingDays: data.destMeetingDays ?? '',

        registradoOfnc: data.registradoOfnc ?? true,
        rritrackActivo: data.rritrackActivo ?? true,

        membershipStatus: data.membershipStatus ?? 'active',
        isVerified: data.isVerified ?? true,

        createdAt: data.createdAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
}