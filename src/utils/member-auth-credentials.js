export const MEMBER_AUTH_DOMAIN = 'exploradores.app';

export const normalizeMemberUsername = (memberCode) =>
  String(memberCode ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9._-]/g, '');

export const buildMemberAuthEmail = (memberCode) => {
  const username = normalizeMemberUsername(memberCode);

  return username ? `${username}@${MEMBER_AUTH_DOMAIN}` : '';
};

export const buildMemberAuthPassword = (memberCode) =>
  normalizeMemberUsername(memberCode).replace(/^do-sd-/i, '');

export const resolveSignInEmail = (loginValue) => {
  const value = String(loginValue ?? '').trim();

  if (!value || value.includes('@')) return value;

  return buildMemberAuthEmail(value);
};
