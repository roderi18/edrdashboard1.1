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

// AQUI VIVIAN las contraseñas iniciales derivadas del codigo del miembro
// (`buildMemberAuthPassword` y compañia). Se retiraron a proposito: como los
// codigos son correlativos, esa clave la deducia cualquiera y se entraba como
// todo el que aun no hubiera elegido la suya.
//
// La cuenta la crea ahora el servidor con una contraseña aleatoria que no ve
// nadie (`/api/auth/crear-cuenta-miembro`), y para entrar la primera vez el
// coordinador dicta un codigo de un solo uso. No las vuelvas a añadir.

export const resolveSignInEmail = (loginValue) => {
  const value = String(loginValue ?? '').trim();

  if (!value || value.includes('@')) return value;

  return buildMemberAuthEmail(value);
};
