// Esta cuenta es la única autorizada para usar el selector de rol de la cabecera.
// La misma comprobación se repite en el servidor; ocultar el control en el cliente
// es solo una medida de interfaz, no la barrera de seguridad.
export const ADMIN_ROLE_SWITCH_EMAIL = 'rdpr18@gmail.com';

export const puedeUsarSelectorDeRol = (email) =>
  String(email ?? '')
    .trim()
    .toLowerCase() === ADMIN_ROLE_SWITCH_EMAIL;
