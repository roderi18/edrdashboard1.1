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

// ----------------------------------------------------------------------
// "VER COMO USUARIO": la misma persona, sin el Administrador Global.
//
// Quien tiene Administrador Global necesita comprobar qué ven los demás en sus
// pestañas y pantallas. Se le quita solo ese rol y todo lo que venía con él
// (permisos sueltos de la cuenta, `role: 'admin'`); se queda con sus otros
// cargos o, sin ninguno, como Usuario Común. Es una vista de la interfaz: vive
// en la pestaña (`sessionStorage`) y las reglas del servidor siguen viendo al
// Administrador Global de verdad.
// ----------------------------------------------------------------------

const CLAVE_VER_COMO_USUARIO = 'ver-como-usuario';

const PESO_ALCANCE = { global: 5, nacional: 4, region: 3, seccion: 2, destacamento: 1 };

export const leerVerComoUsuario = () => {
  try {
    return (
      typeof window !== 'undefined' && window.sessionStorage.getItem(CLAVE_VER_COMO_USUARIO) === '1'
    );
  } catch {
    return false;
  }
};

export const cambiarVerComoUsuario = (activo) => {
  try {
    if (activo) window.sessionStorage.setItem(CLAVE_VER_COMO_USUARIO, '1');
    else window.sessionStorage.removeItem(CLAVE_VER_COMO_USUARIO);
  } catch {
    // Sin almacenamiento no hay vista de usuario: se queda como estaba.
  }
};

/**
 * La sesión sin el Administrador Global. `permisosPorRol` y `alcancePorRol` se
 * reciben de fuera para que este módulo no arrastre el catálogo de permisos.
 */
export const sinAdministradorGlobal = (
  user,
  { permisosPorRol = {}, alcancePorRol = {}, restriccionesPorRol = {} } = {}
) => {
  if (!user) return user;

  const cargos = (Array.isArray(user.cargos) ? user.cargos : []).filter(
    (cargo) =>
      normalizar(cargo?.rol ?? cargo?.rolId ?? cargo?.codigo) !== ROLES.ADMINISTRADOR_GLOBAL
  );
  const codigos = [
    ...new Set(cargos.map((cargo) => normalizar(cargo?.rol ?? cargo?.rolId ?? cargo?.codigo))),
  ].filter(Boolean);
  const principal =
    [...codigos].sort(
      (a, b) => (PESO_ALCANCE[alcancePorRol[b]] ?? 0) - (PESO_ALCANCE[alcancePorRol[a]] ?? 0)
    )[0] || ROLES.USUARIO_COMUN;
  const conPrincipal = codigos.length ? codigos : [principal];
  const alcance = alcancePorRol[principal] || 'destacamento';

  return {
    ...user,
    rolId: principal,
    roleId: principal,
    memberRole: principal,
    rolCodigo: principal,
    roleCodigo: principal,
    // `role`/`rol` dicen 'admin' en la cuenta administrativa, y por ahí volvía el mando.
    rol: principal,
    role: principal,
    rolNombre: ROLES_POR_CODIGO[principal]?.nombre || '',
    cargos,
    permisosRol: [...new Set(conPrincipal.flatMap((codigo) => permisosPorRol[codigo] ?? []))],
    permisos: {},
    permisosDirectos: [],
    permisosAutorizacion: [],
    permisosExcluidos: [],
    restricciones: {
      soloLectura: conPrincipal.every(
        (codigo) => restriccionesPorRol[codigo]?.soloLectura === true
      ),
    },
    alcance: { ...(user.alcance ?? {}), tipo: alcance, modo: alcance },
    verComoUsuario: true,
  };
};
