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

// La clave inicial es el codigo COMPLETO, con su prefijo. Antes se le quitaba el
// "do-sd-" y quedaba solo el numero, pero los codigos nuevos traen cinco digitos
// (SD-10001) y Firebase no acepta claves de menos de seis caracteres: sin el
// prefijo, ninguna cuenta nueva se podria crear.
export const buildMemberAuthPassword = (memberCode) => normalizeMemberUsername(memberCode);

// Los codigos creados antes de ese cambio se dieron de alta con el numero suelto.
// Sirve para reintentar cuando la clave completa no vale.
export const buildMemberAuthPasswordHeredada = (memberCode) =>
  normalizeMemberUsername(memberCode).replace(/^do-sd-/i, '');

export const resolveSignInEmail = (loginValue) => {
  const value = String(loginValue ?? '').trim();

  if (!value || value.includes('@')) return value;

  return buildMemberAuthEmail(value);
};
