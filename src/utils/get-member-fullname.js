export function getMemberFullName(member) {
  if (!member) return '';
  if (member.fullName) return member.fullName;

  return `${member.firstName ?? ''} ${member.lastName ?? ''}`.trim();
}
