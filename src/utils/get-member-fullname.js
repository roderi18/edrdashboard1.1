export function getMemberFullName(member) {
    if (member.fullName) return member.fullName;

    return `${member.firstName ?? ''} ${member.lastName ?? ''}`.trim();
}