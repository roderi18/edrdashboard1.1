/**
 * Cuenta la cantidad de miembros asociados a un destacamento
 * @param {Array} members - Lista de miembros
 * @param {string} destId - ID del destacamento
 * @returns {number}
 */
export function countMembersByDestId(members = [], destId) {
  if (!Array.isArray(members) || !destId) {
    return 0;
  }

  return members.filter((member) => member.destId === destId).length;
}
