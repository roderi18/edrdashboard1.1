// Cuentas administrativas autorizadas para probar la aplicación como otro
// usuario. La misma comprobación se repite en el servidor.
export const ADMIN_ROLE_SWITCH_EMAILS = Object.freeze([
  'rdpr18@gmail.com',
  'rodery123456@gmail.com',
]);

export const puedeUsarSelectorDeRol = (email) =>
  ADMIN_ROLE_SWITCH_EMAILS.includes(String(email ?? '').trim().toLowerCase());
