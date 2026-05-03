import dayjs from 'dayjs';

export const MEMBER_DEFAULT = {
    id: '',
    memberId: '',

    firstName: '',
    lastName: '',

    avatarUrl: null,

    email: '',
    phoneNumber: '',

    country: '',
    province: '',
    city: '',
    memberAddress: '',

    birthDate: null,

    destId: '',

    ocupation: '',
    memberDivision: '',

    gender: '',
    shirtSize: '',

    status: 'active',

    createdAt: '',
    updatedAt: '',
    lastActivityAt: '',
    deletedAt: null,
};

export function createMember(data) {
    return {
        ...MEMBER_DEFAULT,

        id: data.id,
        memberId: data.memberId,

        firstName: data.firstName ?? '',
        lastName: data.lastName ?? '',

        avatarUrl: data.avatarUrl ?? null,

        email: data.email ?? '',
        phoneNumber: data.phoneNumber ?? '',

        country: data.country ?? '',
        province: data.province ?? '',
        city: data.city ?? '',
        memberAddress: data.memberAddress ?? '',

        birthDate: data.birthDate
            ? dayjs(data.birthDate).format('YYYY-MM-DD')
            : null,

        destId: data.destId ?? '',

        ocupation: data.ocupation ?? '',
        memberDivision: data.memberDivision ?? '',
        // memberPosition: data.memberPosition ?? null,

        gender: data.gender ?? '',
        shirtSize: data.shirtSize ?? '',

        InstructorCertificadoCI:
            data.InstructorCertificadoCI === 0 ? null : data.InstructorCertificadoCI,
        EstatusVigenciaCI:
            data.EstatusVigenciaCI === 'na'
                ? null
                : data.EstatusVigenciaCI,
        FechaInicioCI: data.FechaInicioCI
            ? dayjs(data.FechaInicioCI).format('YYYY-MM-DD')
            : null,
        FechaVencimientoCI: data.FechaVencimientoCI
            ? dayjs(data.FechaVencimientoCI).format('YYYY-MM-DD')
            : null,
        status: data.status ?? 'active',

        createdAt: data.createdAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastActivityAt: data.lastActivityAt ?? data.updatedAt ?? data.createdAt ?? new Date().toISOString(),
        deletedAt: data.deletedAt ?? null,
    };
}

