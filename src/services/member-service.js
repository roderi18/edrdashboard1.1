import dayjs from 'dayjs';
import { createMember } from 'src/models/member-model';
import {
    getStorageCollection,
    saveItem,
    setStorageCollection,
} from 'src/utils/storage-service';

// ------------------------------------------------------------
// STORAGE KEYS
// ------------------------------------------------------------

const MEMBERS_KEY = 'members';
const LEADERSHIP_KEY = 'leadershipAssignments';

// ------------------------------------------------------------
// MEMBERS
// ------------------------------------------------------------

export function saveMember(member) {
    const normalizedMember = createMember(member);
    saveItem(MEMBERS_KEY, normalizedMember);
}

export function getMembers() {
    return getStorageCollection(MEMBERS_KEY) || [];
}

export function getMemberById(id) {
    const members = getMembers();
    return members.find((m) => m.id === id);
}

export function updateMember(updatedMember) {
    const members = getMembers();

    const index = members.findIndex((m) => m.id === updatedMember.id);

    if (index !== -1) {
        members[index] = createMember(updatedMember);
    }

    setStorageCollection(MEMBERS_KEY, members);

    return updatedMember;
}

export function deleteMember(memberId) {
    const members = getMembers().filter((m) => m.id !== memberId);
    setStorageCollection(MEMBERS_KEY, members);
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
// SAVE MEMBER + LEADERSHIP
// ------------------------------------------------------------

export function saveMemberWithLeadership({
    member,
    memberUUID,
    destLeadershipRole,
    destId,
    nationalLeadershipLevel,
    nationalLeadershipRole,
}) {

    // guardar miembro
    saveMember(member);

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