const asArray = (value) => (Array.isArray(value) ? value : []);
const asObject = (value) =>
  value && typeof value === 'object' && !Array.isArray(value) ? value : {};

const memberId = (member = {}) => String(member.idMiembros ?? member.id ?? '').trim();
const memberName = (member = {}) =>
  String(
    member.name ??
      member.nombreCompleto ??
      [member.nombres ?? member.nombre, member.apellidos ?? member.apellido]
        .filter(Boolean)
        .join(' ')
  ).trim();

export const buildReactionGroups = ({ reactions = {}, participants = [], currentContact } = {}) => {
  const currentMemberId = memberId(currentContact);
  const membersById = new Map(
    [...asArray(participants), currentContact]
      .filter(Boolean)
      .map((member) => [memberId(member), member])
      .filter(([id]) => id)
  );
  const groupsByEmoji = new Map();

  Object.entries(asObject(reactions)).forEach(([id, reaction]) => {
    const emoji = String(reaction ?? '').trim();
    if (!emoji) return;

    const group = groupsByEmoji.get(emoji) ?? { emoji, memberIds: [], names: [] };
    const member = membersById.get(String(id));
    const name = memberName(member) || 'Miembro';

    group.memberIds.push(String(id));
    group.names.push(String(id) === currentMemberId ? `${name} (Tú)` : name);
    groupsByEmoji.set(emoji, group);
  });

  return Array.from(groupsByEmoji.values()).map((group) => ({
    ...group,
    count: group.memberIds.length,
  }));
};
