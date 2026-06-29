import dayjs from 'dayjs';

import { getStorageCollection, setStorageCollection } from 'src/utils/storage-service';

import { registrarAuditoriaSilenciosa } from './audit-log-service';

// ------------------------------------------------------------
// STORAGE KEYS
// ------------------------------------------------------------

const MEMBERS_KEY = 'members';
const LEADERSHIP_KEY = 'leadershipAssignments';

const getMemberCacheId = (member) =>
  member?.id ?? member?.idMiembros ?? member?.codigoMiembro ?? member?.memberId;

const getDivisionIdByBirthdate = (birthDate) => {
  if (!birthDate) return null;

  const today = new Date();
  const [year, month, day] = String(birthDate).split('T')[0].split('-');
  const birth = new Date(Number(year), Number(month) - 1, Number(day));

  if (Number.isNaN(birth.getTime())) return null;

  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age -= 1;
  }

  if (age >= 5 && age <= 7) return 1;
  if (age >= 8 && age <= 10) return 2;
  if (age >= 11 && age <= 13) return 3;
  if (age >= 14 && age <= 17) return 4;
  if (age >= 18) return 5;

  return null;
};

const normalizeMemberStatus = (status) => {
  const normalizedStatus = String(status || '')
    .trim()
    .toLowerCase();

  if (['banned', 'inactivo', 'inactive', 'suspendido', 'bloqueado'].includes(normalizedStatus)) {
    return 'banned';
  }

  return 'active';
};

const normalizeCachedMember = (member) => {
  if (!member) return null;

  if (member.idMiembros && !member.firstName && !member.lastName) {
    return mapApiMemberToUI(member);
  }

  const id = getMemberCacheId(member);

  if (id === null || id === undefined || id === '') return null;

  return {
    ...member,
    id: String(id),
    memberId: member.memberId ?? member.codigoMiembro ?? member.idMiembros ?? String(id),
    destId: String(member.destId ?? member.idDestacamento ?? ''),
    status: normalizeMemberStatus(member.status ?? member.estatusMiembro),
  };
};

const mergeMembersById = (...sources) => {
  const mergedMembers = new Map();

  sources.flat().forEach((member) => {
    const normalizedMember = normalizeCachedMember(member);

    if (!normalizedMember?.id) return;
    if (mergedMembers.has(String(normalizedMember.id))) return;

    mergedMembers.set(String(normalizedMember.id), normalizedMember);
  });

  return Array.from(mergedMembers.values());
};

export function getCachedMembers() {
  return mergeMembersById(getStorageCollection(MEMBERS_KEY) || []);
}

export function mapApiMemberToUI(member) {
  return {
    id: String(member.idMiembros),
    memberId: member.codigoMiembro,

    firstName: member.nombres || '',
    lastName: member.apellidos || '',
    idDestacamento: member.idDestacamento ?? null,

    gender: member.genero || '',
    birthDate: member.fechaNacimiento || null,
    idDivision: member.idDivision ?? getDivisionIdByBirthdate(member.fechaNacimiento),
    shirtSize: member.sizeCamisas || '',
    ocupation: member.ocupacion || '',

    destId: String(member.idDestacamento || ''),

    phoneNumber: member.telefono || '',
    memberAddress: member.direccion || '',
    email: member.correo || '',

    status: normalizeMemberStatus(member.estatusMiembro),
    province: member.provincia || member.province || '',
    region: member.region || '',
    createdAt: member.createdAt || member.fechaCreacion || null,
    updatedAt: member.updatedAt || member.fechaActualizacion || null,
    lastActivityAt:
      member.lastActivityAt ||
      member.ultimaActividad ||
      member.updatedAt ||
      member.fechaActualizacion ||
      null,
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

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Error al obtener miembros (${res.status}): ${body || res.statusText}`);
    }

    const response = await res.json();

    const data = response.data || response.Data || response.items || response;
    const apiMembers = Array.isArray(data) ? data.map(mapApiMemberToUI) : [];
    const mergedMembers = mergeMembersById(apiMembers, getCachedMembers());

    setStorageCollection(MEMBERS_KEY, mergedMembers);

    return mergedMembers;
  } catch (error) {
    console.error('ERROR FETCH ERROR:', error);
    return getStorageCollection(MEMBERS_KEY) || [];
  }
}

export async function getMemberById(id) {
  const members = await getMembers();
  return members.find((m) => String(m.id) === String(id));
}

const getMemberDisplayName = (member = {}) =>
  [member.firstName || member.nombres, member.lastName || member.apellidos].filter(Boolean).join(' ') ||
  member.nombre ||
  member.nombreMiembro ||
  member.codigoMiembro ||
  member.memberId ||
  'Miembro';

export async function createMemberApi(payload, { usuario } = {}) {
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

  const response = text ? JSON.parse(text) : {};

  registrarAuditoriaSilenciosa({
    modulo: 'miembros',
    accion: 'miembro_creado',
    descripcion: `Se creó el miembro ${getMemberDisplayName(payload)}.`,
    entidad: {
      tipo: 'miembro',
      id: response?.idMiembros || response?.data?.idMiembros || payload?.idMiembros,
      nombre: getMemberDisplayName(payload),
      ruta: '/dashboard/level/member',
    },
    despues: payload,
    realizadoPor: usuario,
    origen: 'miembros',
  });

  return response;
}

export async function updateMemberApi(payload, { usuario, antes = null } = {}) {
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

  registrarAuditoriaSilenciosa({
    modulo: 'miembros',
    accion: 'miembro_actualizado',
    descripcion: `Se actualizó el miembro ${getMemberDisplayName(payload)}.`,
    entidad: {
      tipo: 'miembro',
      id: payload?.idMiembros || payload?.id,
      nombre: getMemberDisplayName(payload),
      ruta: `/dashboard/level/member/${payload?.idMiembros || payload?.id || ''}/edit`,
    },
    antes,
    despues: payload,
    realizadoPor: usuario,
    origen: 'miembros',
  });

  return response;
}

export async function deleteMember(memberId, { usuario, antes = null } = {}) {
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

  if (!text) {
    registrarAuditoriaSilenciosa({
      modulo: 'miembros',
      accion: 'miembro_eliminado',
      descripcion: `Se eliminó el miembro ${getMemberDisplayName(antes)}.`,
      severidad: 'importante',
      entidad: {
        tipo: 'miembro',
        id: memberId,
        nombre: getMemberDisplayName(antes),
        ruta: '/dashboard/level/member',
      },
      antes,
      realizadoPor: usuario,
      origen: 'miembros',
    });

    return {};
  }

  try {
    const response = JSON.parse(text);

    registrarAuditoriaSilenciosa({
      modulo: 'miembros',
      accion: 'miembro_eliminado',
      descripcion: `Se eliminó el miembro ${getMemberDisplayName(antes)}.`,
      severidad: 'importante',
      entidad: {
        tipo: 'miembro',
        id: memberId,
        nombre: getMemberDisplayName(antes),
        ruta: '/dashboard/level/member',
      },
      antes,
      realizadoPor: usuario,
      origen: 'miembros',
    });

    return response;
  } catch {
    registrarAuditoriaSilenciosa({
      modulo: 'miembros',
      accion: 'miembro_eliminado',
      descripcion: `Se eliminó el miembro ${getMemberDisplayName(antes)}.`,
      severidad: 'importante',
      entidad: {
        tipo: 'miembro',
        id: memberId,
        nombre: getMemberDisplayName(antes),
        ruta: '/dashboard/level/member',
      },
      antes,
      realizadoPor: usuario,
      origen: 'miembros',
    });

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
    (l) => l.memberId === memberId && (l.status === 'active' || !l.status)
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

    if (item.memberId === memberUUID && (item.level === 'dest' || item.level === 'national')) {
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
  if (nationalLeadershipLevel && nationalLeadershipLevel !== 'none' && nationalLeadershipRole) {
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

  registrarAuditoriaSilenciosa({
    modulo: 'cargos_liderazgos',
    accion: 'liderazgo_miembro_actualizado',
    descripcion: `Se actualizaron los cargos o liderazgos del miembro ${memberUUID}.`,
    entidad: {
      tipo: 'miembro',
      id: memberUUID,
      nombre: memberUUID,
      ruta: `/dashboard/level/member/${memberUUID}/edit`,
    },
    despues: {
      destLeadershipRole,
      destId,
      nationalLeadershipLevel,
      nationalLeadershipRole,
    },
    origen: 'miembros',
  });
}
