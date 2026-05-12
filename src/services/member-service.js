import dayjs from 'dayjs';

import {
    getStorageCollection,
    setStorageCollection,
} from 'src/utils/storage-service';

// ------------------------------------------------------------
// STORAGE KEYS
// ------------------------------------------------------------

const MEMBERS_KEY = 'members';
const LEADERSHIP_KEY = 'leadershipAssignments';

export function mapApiMemberToUI(member) {
    return {
        id: String(member.idMiembros),
        memberId: member.codigoMiembro,

        firstName: member.nombres || '',
        lastName: member.apellidos || '',
        idDestacamento: member.idDestacamento ?? null,

        gender: member.genero || '',
        birthDate: member.fechaNacimiento || null,

        destId: String(member.idDestacamento || ''),

        phoneNumber: member.telefono || '',
        memberAddress: member.direccion || '',
        email: member.correo || '',

        status: member.estatusMiembro || 'active',
        province: member.provincia || member.province || '',
        region: member.region || '',
        createdAt: member.createdAt || member.fechaCreacion || null,
        updatedAt: member.updatedAt || member.fechaActualizacion || null,
        lastActivityAt: member.lastActivityAt || member.ultimaActividad || member.updatedAt || member.fechaActualizacion || null,
        deletedAt: member.deletedAt || member.fechaEliminacion || null,

        InstructorCertificadoCI: member.instructorCertificadoCi ? 1 : 0,
        EstatusVigenciaCI: member.estatusVigenciaCi ? 1 : 0,
        FechaInicioCI: member.fechaInicioCertificado || null,
        FechaVencimientoCI: member.fechaFinCertificado || null,
    };
}

// ------------------------------------------------------------
// MEMBERS
// ------------------------------------------------------------

export async function getMembers() {
    try {
        const res = await fetch('/api/members');

        if (!res.ok) throw new Error('Error al obtener miembros');

        const response = await res.json();

        const data = response.data || response.Data || response.items || response;
        const apiMembers = Array.isArray(data) ? data.map(mapApiMemberToUI) : [];
        const localMembers = getStorageCollection(MEMBERS_KEY) || [];
        const mergedMembers = new Map();

        apiMembers.forEach((member) => {
            mergedMembers.set(String(member.id), { ...member });
        });

        localMembers.forEach((member) => {
            if (!member?.id) return;
            if (mergedMembers.has(String(member.id))) return;

            mergedMembers.set(String(member.id), {
                ...member,
                id: String(member.id),
            });
        });

        return Array.from(mergedMembers.values());
    } catch (error) {
        console.error('âŒ FETCH ERROR:', error);
        return getStorageCollection(MEMBERS_KEY) || [];
    }
}

export async function getMemberById(id) {
    const members = await getMembers();
    return members.find((m) => String(m.id) === String(id));
}

export async function createMemberApi(payload) {
    const res = await fetch('/api/members/post', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });

    const text = await res.text();

    if (!res.ok) {
        throw new Error(text || 'Error creando miembro');
    }

    return text ? JSON.parse(text) : {};
}

export async function updateMemberApi(payload) {
    const res = await fetch('/api/members/put', {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });

    const text = await res.text();
    const response = text ? JSON.parse(text) : {};

    if (!res.ok) {
        throw new Error(
            response?.message ||
                response?.Message ||
                response?.error ||
                text ||
                'Error actualizando miembro'
        );
    }

    return response;
}

export async function deleteMember(memberId) {
    const res = await fetch(`/api/members?id=${encodeURIComponent(memberId)}`, {
        method: 'DELETE',
    });
    const text = await res.text();

    if (!res.ok) {
        throw new Error(text || `Error eliminando miembro (${res.status})`);
    }

    const members = getStorageCollection(MEMBERS_KEY).filter(
        (m) => String(m.id) !== String(memberId)
    );
    setStorageCollection(MEMBERS_KEY, members);

    if (!text) return {};

    try {
        return JSON.parse(text);
    } catch {
        return { raw: text };
    }
}

// ------------------------------------------------------------
// LEADERSHIP ASSIGNMENTS
// ------------------------------------------------------------

export function getLeadershipAssignments() {
    return getStorageCollection(LEADERSHIP_KEY) || [];
}

export function setLeadershipAssignments(data) {
    setStorageCollection(LEADERSHIP_KEY, data);
}

// ------------------------------------------------------------
// MEMBER LEADERSHIP
// ------------------------------------------------------------

export function getMemberLeadership(memberId) {
    const leadershipAssignments = getLeadershipAssignments();

    return leadershipAssignments.filter(
        (l) =>
            l.memberId === memberId &&
            (l.status === 'active' || !l.status)
    );
}

// ------------------------------------------------------------
// SAVE LEADERSHIP
// ------------------------------------------------------------

export function saveMemberWithLeadership({
    memberUUID,
    destLeadershipRole,
    destId,
    nationalLeadershipLevel,
    nationalLeadershipRole,
}) {
    const assignments = getLeadershipAssignments();

    // eliminar asignaciones anteriores del miembro
    for (let i = assignments.length - 1; i >= 0; i--) {
        const item = assignments[i];

        if (
            item.memberId === memberUUID &&
            (item.level === 'dest' || item.level === 'national')
        ) {
            assignments.splice(i, 1);
        }
    }

    // liderazgo destacamento
    if (destLeadershipRole && destLeadershipRole !== 'none') {
        assignments.push({
            id: crypto.randomUUID(),
            memberId: memberUUID,
            level: 'dest',
            entityId: destId,
            role: destLeadershipRole,
            status: 'active',
            startDate: dayjs().format('YYYY-MM-DD'),
            endDate: null,
        });
    }

    // liderazgo nacional
    if (
        nationalLeadershipLevel &&
        nationalLeadershipLevel !== 'none' &&
        nationalLeadershipRole
    ) {
        assignments.push({
            id: crypto.randomUUID(),
            memberId: memberUUID,
            level: 'national',
            entityId: 'national-root',
            role: nationalLeadershipRole,
            status: 'active',
            startDate: dayjs().format('YYYY-MM-DD'),
            endDate: null,
        });
    }

    setLeadershipAssignments(assignments);
}
