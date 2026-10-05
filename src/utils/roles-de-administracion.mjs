// ----------------------------------------------------------------------
// VARIOS ROLES DE ADMINISTRACIÓN EN UNA MISMA PERSONA.
//
// Cada cuenta guardaba UN solo rol de administración en `rolId`: dar otro desde
// Administradores REEMPLAZABA el anterior. A Eliezer García (Coordinador de su
// destacamento y Oficina Nacional) darle el de Administrador de Gestión de
// Tienda le quitaba la Oficina Nacional. Ahora se guarda la lista entera en
// `rolesAdministracion` y se añaden o quitan de uno en uno.
//
// `rolId` sigue siendo el PRINCIPAL —el de más rango— porque lo leen el token,
// las reglas y medio código; los demás viajan en la lista y en `rolesQueEjerce`,
// y los guardas preguntan por todos. Ningún rol le quita nada a otro: los
// permisos se suman, y "solo lectura" (de la Oficina Nacional) solo manda si
// TODOS sus roles lo son (`can.js`).
//
// Sin React ni Firebase, para probarlo con `node --test`.
// ----------------------------------------------------------------------

// De más a menos rango: el primero que tenga es el principal.
export const ROLES_DE_ADMINISTRACION_POR_RANGO = Object.freeze([
  'administrador_global',
  'administrador_funcional',
  'oficina_nacional',
  'administrador_tienda',
]);

const codigo = (valor) =>
  String(valor ?? '')
    .trim()
    .toLowerCase();

const esDeAdministracion = (valor) => ROLES_DE_ADMINISTRACION_POR_RANGO.includes(codigo(valor));

const ordenar = (lista) =>
  [...new Set(lista.map(codigo).filter(esDeAdministracion))].sort(
    (a, b) => ROLES_DE_ADMINISTRACION_POR_RANGO.indexOf(a) - ROLES_DE_ADMINISTRACION_POR_RANGO.indexOf(b)
  );

/**
 * Los roles de administración de un perfil o una sesión: la lista guardada y,
 * para las cuentas de antes de la lista, el `rolId` si es uno de ellos.
 */
export const rolesDeAdministracionDe = (datos = {}) =>
  ordenar([
    ...(Array.isArray(datos?.rolesAdministracion) ? datos.rolesAdministracion : []),
    datos?.rolId,
  ]);

/** El de más rango, o '' si no tiene ninguno. */
export const rolPrincipalDeAdministracion = (lista = []) => ordenar(lista)[0] || '';

/** La lista con ese rol añadido (sin repetir, en orden de rango). */
export const conRolDeAdministracion = (lista = [], rol = '') => ordenar([...lista, rol]);

/** La lista sin ese rol. */
export const sinRolDeAdministracion = (lista = [], rol = '') =>
  ordenar(lista).filter((actual) => actual !== codigo(rol));
