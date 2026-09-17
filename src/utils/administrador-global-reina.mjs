import { ROLES, ROLES_POR_CODIGO } from 'src/auth/permissions/roles';

// ----------------------------------------------------------------------
// EL ADMINISTRADOR GLOBAL REINA SOBRE CUALQUIER OTRO CARGO.
//
// Quien es Administrador Global y además ocupa casillas en la directiva entraba
// a veces con el cargo de la casilla como principal: la sesión de miembro sale
// de sus asignaciones, y el Administrador Global llegaba aparte (o en `cargos`).
// Con eso la dominancia por módulo le daba el mando a su cargo de destacamento o
// de región, y perdía lo del Administrador Global: sus propuestas quedaban
// pendientes de aprobación y no veía, por ejemplo, el lápiz de las cintas.
//
// Aquí se decide una vez: si lo ejerce por cualquier vía, es su rol principal.
// Sus otros cargos se conservan en `cargos` (los avisos y las listas los usan).
// ----------------------------------------------------------------------

const normalizar = (valor) =>
  String(valor ?? '')
    .trim()
    .toLowerCase();

export const ejerceAdministradorGlobal = (user = {}) => {
  if (!user) return false;

  const principales = [
    user.rolId,
    user.roleId,
    user.rolCodigo,
    user.roleCodigo,
    user.memberRole,
    user.rol,
    user.role,
  ];
  const deSusCargos = (Array.isArray(user.cargos) ? user.cargos : []).map(
    (cargo) => cargo?.rol ?? cargo?.rolId ?? cargo?.codigo
  );

  return [...principales, ...deSusCargos].map(normalizar).includes(ROLES.ADMINISTRADOR_GLOBAL);
};

/** La sesión con el Administrador Global como rol principal, si lo ejerce. */
export const conAdministradorGlobalAlMando = (user) => {
  if (!user || !ejerceAdministradorGlobal(user)) return user;

  return {
    ...user,
    rolId: ROLES.ADMINISTRADOR_GLOBAL,
    roleId: ROLES.ADMINISTRADOR_GLOBAL,
    memberRole: ROLES.ADMINISTRADOR_GLOBAL,
    rolNombre: ROLES_POR_CODIGO[ROLES.ADMINISTRADOR_GLOBAL]?.nombre || user.rolNombre,
  };
};
