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

// La clave inicial es el codigo COMPLETO Y EN MAYUSCULAS, tal como se ve en la
// ficha del miembro: "EDR-10002". Las claves distinguen mayusculas, asi que se
// teclea exactamente como esta escrito el codigo.
//
// Lleva el prefijo a proposito: antes se le quitaba y quedaba solo el numero,
// pero los codigos traen cinco digitos y Firebase no acepta claves de menos de
// seis caracteres.
export const buildMemberAuthPassword = (memberCode) =>
  normalizeMemberUsername(memberCode).toUpperCase();

// Formas con las que se dieron de alta las cuentas ANTERIORES a los cambios: en
// minusculas, y antes de eso solo el numero. No se ofrecen en el formulario de
// acceso —ahi la clave se comprueba tal cual se escribe—, pero si sirven para
// reautenticar por dentro a quien todavia tenga una de ellas.
export const buildMemberAuthPasswordMinusculas = (memberCode) =>
  normalizeMemberUsername(memberCode);

export const buildMemberAuthPasswordHeredada = (memberCode) =>
  normalizeMemberUsername(memberCode).replace(/^[a-z]+-(?:[a-z]+-)?/i, '');

// Todas las formas de la clave inicial, de la actual a la mas antigua.
export const clavesInicialesMiembro = (memberCode) =>
  [
    buildMemberAuthPassword(memberCode),
    buildMemberAuthPasswordMinusculas(memberCode),
    buildMemberAuthPasswordHeredada(memberCode),
  ].filter((clave) => clave && clave.length >= 6);

export const resolveSignInEmail = (loginValue) => {
  const value = String(loginValue ?? '').trim();

  if (!value || value.includes('@')) return value;

  return buildMemberAuthEmail(value);
};
