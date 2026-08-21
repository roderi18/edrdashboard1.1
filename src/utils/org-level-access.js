import { ROLES, ALCANCES, ROLES_POR_CODIGO } from 'src/auth/permissions/roles';
import { ALCANCE_PREDETERMINADO_ROL } from 'src/auth/permissions/role-permissions';

// ----------------------------------------------------------------------
// Predicados de alcance para niveles organizacionales (regiones, secciones,
// destacamentos).
//
// Modelo: los administradores de seccion y de region VEN todos los niveles,
// pero solo pueden EDITAR dentro de su propio alcance:
//   - Admin de seccion: edita su seccion y crea/edita destacamentos de su seccion.
//   - Admin de region: edita su region, crea/edita secciones de su region y edita
//     destacamentos de su region.
//   - Ninguno elimina niveles. Solo los administradores global/funcional editan
//     y eliminan sin restriccion de alcance.
// ----------------------------------------------------------------------

const GLOBAL_MANAGER_ROLES = [ROLES.ADMINISTRADOR_GLOBAL, ROLES.ADMINISTRADOR_FUNCIONAL];

const normalizeId = (value) => String(value ?? '').trim();

export const getOrgRoleId = (user = {}) => {
  const rawRole = String(user?.rol || user?.role || '').trim();

  return String(
    user?.rolId ||
      user?.roleId ||
      user?.rolCodigo ||
      user?.roleCodigo ||
      user?.memberRole ||
      (ROLES_POR_CODIGO[rawRole] ? rawRole : '')
  )
    .trim()
    .toLowerCase();
};

// Un miembro sin cargo es un Usuario Comun: su sesion guarda `rol: 'miembro'`,
// que no es un codigo del catalogo, asi que getOrgRoleId devuelve vacio. Se
// resuelve aqui en vez de importar member-access, que no depende de este modulo
// y conviene que siga sin hacerlo.
const esUsuarioComun = (user = {}) => {
  const roleId = getOrgRoleId(user);

  if (roleId === ROLES.USUARIO_COMUN) return true;

  const esAdmin = ['admin', 'administrador'].includes(
    String(user?.role ?? user?.rol ?? '').trim().toLowerCase()
  );

  // Se compara contra el catalogo y no contra la cadena vacia: la sesion sin
  // cargo guarda 'miembro' en `rol` y `memberRole`, que no es un codigo valido.
  return Boolean(user) && !esAdmin && !ROLES_POR_CODIGO[roleId];
};

export const isGlobalOrgManager = (user = {}) => GLOBAL_MANAGER_ROLES.includes(getOrgRoleId(user));

// Solo el Administrador Global. Es el unico rol autorizado a ELIMINAR entidades
// (miembros, destacamentos, secciones, regiones y consejo nacional). Ningun otro
// rol —ni siquiera el Administrador Funcional— puede eliminar.
export const isAdminGlobal = (user = {}) => getOrgRoleId(user) === ROLES.ADMINISTRADOR_GLOBAL;

// Roles cuyo alcance limita lo que pueden editar. Incluye a los coordinadores de
// area (solo consulta) para que nunca se traten como administradores plenos.
const SCOPED_ORG_ROLES = [
  ROLES.USUARIO_DESTACAMENTO,
  ROLES.USUARIO_DESTACAMENTO_ASISTENTE,
  // Cargos de destacamento: mismo perfil acotado que el Coordinador (nunca son
  // administradores plenos, solo gestionan/consultan dentro de su destacamento).
  ROLES.PASTOR_DESTACAMENTO,
  ROLES.CONSEJO_DESTACAMENTO,
  ROLES.CAPELLAN_DESTACAMENTO,
  ROLES.LIDER_GRUPO,
  ROLES.LIDER_ASISTENTE_GRUPO,
  ROLES.USUARIO_SECCION,
  ROLES.USUARIO_SECCION_ASISTENTE,
  ROLES.USUARIO_REGION,
  ROLES.USUARIO_REGION_ASISTENTE,
  ROLES.COORDINADOR_ADIESTRAMIENTO_SECCION,
  ROLES.COORDINADOR_PROMOCION_SECCION,
  ROLES.COORDINADOR_PRODUCCION_SECCION,
  ROLES.COORDINADOR_PROGRAMA_SECCION,
  ROLES.COORDINADOR_ADIESTRAMIENTO_REGION,
  ROLES.COORDINADOR_PROMOCION_REGION,
  ROLES.COORDINADOR_PRODUCCION_REGION,
  ROLES.COORDINADOR_PROGRAMA_REGION,
  // Cargos de consulta de solo lectura: nunca administradores plenos.
  ROLES.CAPELLAN_REGIONAL,
  ROLES.CAPELLAN_SECCIONAL,
  ROLES.SECRETARIO_REGIONAL,
  ROLES.ZONAS,
  ROLES.GRUPOS_LOCALES,
];

// Alias de alcance: cada asistente comparte el alcance de su titular. Los
// permisos concretos (que difieren) se controlan en PERMISOS_POR_ROL; aqui solo
// se decide el "propio vs ajeno" segun el nivel.
//
// Los cargos regionales pasaron a consulta de solo lectura (perfil del Consejo
// Nacional): ya NO editan ni crean regiones/secciones/destacamentos. Se deja
// vacio para que ningun predicado de edicion los trate como gestores; su alcance
// regional solo acota que MIEMBROS ven (ver member-access.js).
const REGION_SCOPED_ROLES = [];
const SECTION_SCOPED_ROLES = [ROLES.USUARIO_SECCION, ROLES.USUARIO_SECCION_ASISTENTE];
const DEST_SCOPED_ROLES = [ROLES.USUARIO_DESTACAMENTO, ROLES.USUARIO_DESTACAMENTO_ASISTENTE];

// Coordinador / Sub-Coordinador Seccional: su alcance de edición está acotado a
// su propia sección (no crean/editan en otras).
export const isSectionScopedManager = (user = {}) =>
  SECTION_SCOPED_ROLES.includes(getOrgRoleId(user));

// Coordinador Regional / Sub-Director Regional: su alcance de edición está
// acotado a su propia región (crean/editan secciones solo dentro de ella).
export const isRegionScopedManager = (user = {}) =>
  REGION_SCOPED_ROLES.includes(getOrgRoleId(user));

// Coordinador Regional y Sub-Director Regional: pueden dar de ALTA secciones y
// destacamentos, siempre dentro de SU PROPIA REGION. Es una excepcion acotada a
// la creacion: siguen siendo cargos de consulta (`soloLectura`), por lo que no
// editan ni eliminan lo ya existente. Va en una lista propia y no en
// REGION_SCOPED_ROLES precisamente para no reabrirles la edicion.
const REGION_CREATOR_ROLES = [ROLES.USUARIO_REGION, ROLES.USUARIO_REGION_ASISTENTE];

export const isRegionScopedCreator = (user = {}) =>
  REGION_CREATOR_ROLES.includes(getOrgRoleId(user));

const isAdminSession = (user = {}) =>
  ['admin', 'administrador'].includes(String(user?.role ?? user?.rol ?? '').trim().toLowerCase());

// Administrador "pleno" sin alcance acotado: global, funcional o una sesion de
// administrador legada (sin rol organizacional acotado). Editan cualquier nivel.
// Se excluye explicitamente al administrador de tienda.
export const isFullOrgManager = (user = {}) => {
  if (isGlobalOrgManager(user)) return true;

  const roleId = getOrgRoleId(user);

  if (SCOPED_ORG_ROLES.includes(roleId) || roleId === ROLES.ADMINISTRADOR_TIENDA) {
    return false;
  }

  return isAdminSession(user);
};

const getScope = (user = {}) => user?.alcance ?? {};

const toIdSet = (...values) =>
  new Set(
    values
      .flat()
      .filter((value) => value !== null && value !== undefined && value !== '')
      .map(normalizeId)
  );

export const getRegionScopeIds = (user = {}) => {
  const scope = getScope(user);

  return toIdSet(scope?.regiones, scope?.regionId, scope?.idRegion, user?.regionId, user?.idRegion);
};

export const getSectionScopeIds = (user = {}) => {
  const scope = getScope(user);

  return toIdSet(
    scope?.secciones,
    scope?.seccionId,
    scope?.idSeccion,
    user?.seccionId,
    user?.idSeccion
  );
};

export const getDestScopeIds = (user = {}) => {
  const scope = getScope(user);

  return toIdSet(
    scope?.destacamentos,
    scope?.destacamentoId,
    scope?.idDestacamento,
    user?.destacamentoId,
    user?.idDestacamento
  );
};

// --- Lectura de ids desde las filas/entidades ---

const getSectionalOwnId = (sectional = {}) =>
  normalizeId(sectional?.idSeccion ?? sectional?.id ?? sectional?.sectionalId);

const getSectionalRegionId = (sectional = {}) =>
  normalizeId(sectional?.regionalId ?? sectional?.idRegion ?? sectional?.regionId);

const getDestSectionId = (dest = {}) =>
  normalizeId(dest?.sectionalId ?? dest?.idSeccion ?? dest?.seccionId ?? dest?.sectionId);

const getDestRegionId = (dest = {}) =>
  normalizeId(dest?.regionalId ?? dest?.idRegion ?? dest?.regionId);

const getDestOwnId = (dest = {}) =>
  normalizeId(dest?.id ?? dest?.idDestacamento ?? dest?.destId);

// ----------------------------------------------------------------------
// Edicion por entidad
// ----------------------------------------------------------------------

export const canEditRegional = (user = {}) => {
  // Editar regiones queda reservado a los administradores global/funcional. Los
  // cargos regionales pasaron a consulta de solo lectura.
  if (isGlobalOrgManager(user)) return true;

  return false;
};

export const canEditSectional = (user = {}, sectional = {}) => {
  if (isGlobalOrgManager(user)) return true;

  const roleId = getOrgRoleId(user);

  // Director Regional y su Sub-Director editan secciones de su region.
  if (REGION_SCOPED_ROLES.includes(roleId)) {
    const regionId = getSectionalRegionId(sectional);
    return Boolean(regionId) && getRegionScopeIds(user).has(regionId);
  }

  // Solo el Coordinador Seccional titular edita su seccion (el Sub-Coordinador no).
  if (roleId === ROLES.USUARIO_SECCION) {
    const sectionId = getSectionalOwnId(sectional);
    return Boolean(sectionId) && getSectionScopeIds(user).has(sectionId);
  }

  return false;
};

export const canEditDest = (user = {}, dest = {}) => {
  if (isFullOrgManager(user)) return true;

  const roleId = getOrgRoleId(user);

  if (REGION_SCOPED_ROLES.includes(roleId)) {
    const regionId = getDestRegionId(dest);
    return Boolean(regionId) && getRegionScopeIds(user).has(regionId);
  }

  if (SECTION_SCOPED_ROLES.includes(roleId)) {
    const sectionId = getDestSectionId(dest);
    return Boolean(sectionId) && getSectionScopeIds(user).has(sectionId);
  }

  if (DEST_SCOPED_ROLES.includes(roleId)) {
    const destId = getDestOwnId(dest);
    return Boolean(destId) && getDestScopeIds(user).has(destId);
  }

  return false;
};

// ----------------------------------------------------------------------
// Creacion
// ----------------------------------------------------------------------

// Toda alta queda DENTRO del alcance de quien la hace; la unica excepcion es el
// Administrador Global (y el Funcional), que crean en cualquier nivel.
//
// Dos modos de pregunta:
//   - Sin destino (`regionId`/`sectionId` en null): "¿le muestro el boton?". Se
//     responde por ROL, sin exigir que el alcance ya este resuelto, porque el
//     boton solo lleva al formulario y este acota las opciones.
//   - Con destino concreto: se valida de verdad y, si el destino no cae en su
//     alcance, se DENIEGA. Si el alcance no se pudo resolver tampoco se permite:
//     no poder comprobarlo no es lo mismo que estar autorizado.
//
// `ownRegionIds`/`ownSectionIds` permiten pasar el alcance ya DERIVADO (por
// membresia o por direccion de la entidad), que es mas completo que el del token;
// si no se pasan, se cae al alcance explicito de la sesion.

// Admin de region crea secciones dentro de su region.
export const canCreateSectionalInRegion = (user = {}, regionId = null, { ownRegionIds } = {}) => {
  if (isGlobalOrgManager(user)) return true;

  const roleId = getOrgRoleId(user);
  const esCreadorRegional =
    REGION_SCOPED_ROLES.includes(roleId) || REGION_CREATOR_ROLES.includes(roleId);

  if (!esCreadorRegional) return false;

  if (regionId === null) return true;

  const scope = ownRegionIds instanceof Set ? ownRegionIds : getRegionScopeIds(user);

  return scope.has(normalizeId(regionId));
};

// Admin de seccion crea destacamentos dentro de su seccion; los cargos regionales,
// en cualquier seccion de su region. `regionId` es la region a la que pertenece la
// seccion destino: la necesitan los regionales, cuyo alcance se expresa por region.
export const canCreateDestInSection = (
  user = {},
  sectionId = null,
  { regionId, ownSectionIds, ownRegionIds } = {}
) => {
  if (isGlobalOrgManager(user)) return true;

  const roleId = getOrgRoleId(user);

  if (SECTION_SCOPED_ROLES.includes(roleId)) {
    if (sectionId === null) return true;

    const scope = ownSectionIds instanceof Set ? ownSectionIds : getSectionScopeIds(user);

    return scope.has(normalizeId(sectionId));
  }

  if (REGION_CREATOR_ROLES.includes(roleId)) {
    if (sectionId === null && (regionId === null || regionId === undefined)) return true;

    // La seccion destino tiene que resolverse a una region para poder comprobarla.
    if (regionId === null || regionId === undefined) return false;

    const scope = ownRegionIds instanceof Set ? ownRegionIds : getRegionScopeIds(user);

    return scope.has(normalizeId(regionId));
  }

  return false;
};

// Valida el destino al guardar una seccion: el admin de region solo puede
// asignarla a una region de su alcance; el admin de seccion edita su propia
// seccion sin reasignarla fuera (su alcance es por id de seccion, no por region).
export const canAssignSectionalToRegion = (user = {}, regionId = null, { ownRegionIds } = {}) => {
  if (isFullOrgManager(user)) return true;

  const roleId = getOrgRoleId(user);

  if (REGION_SCOPED_ROLES.includes(roleId) || REGION_CREATOR_ROLES.includes(roleId)) {
    const scope = ownRegionIds instanceof Set ? ownRegionIds : getRegionScopeIds(user);

    return scope.has(normalizeId(regionId));
  }

  if (roleId === ROLES.USUARIO_SECCION) {
    return true;
  }

  return false;
};

// ----------------------------------------------------------------------
// Eliminacion: reservada EXCLUSIVAMENTE al Administrador Global. Ningun otro
// rol puede eliminar niveles ni entidades.
// ----------------------------------------------------------------------

export const canDeleteOrgLevel = (user = {}) => isAdminGlobal(user);

// ----------------------------------------------------------------------
// Contadores de miembros en las listas de niveles (regiones/secciones/
// destacamentos): un usuario ACOTADO no puede entrar a la lista de miembros de
// entidades AJENAS a su alcance, por lo que su contador de miembros se muestra
// como texto (sin enlace). La pertenencia cae en CASCADA hacia abajo: quien tiene
// una region "posee" sus secciones y destacamentos; quien tiene una seccion
// "posee" sus destacamentos. Los supervisores plenos (admin global/funcional,
// consejo nacional y sesiones admin legadas) nunca tienen restriccion.
// ----------------------------------------------------------------------

export const isUnrestrictedOrgViewer = (user = {}) => isFullOrgManager(user);

// Cargos de nivel SECCION y REGION (Coordinador Seccional y Regional, sus
// asistentes, los coordinadores de area de ambos niveles y los cargos de consulta
// —capellanes, Secretario Regional, Zonas, Grupos Locales—). Se derivan de
// ALCANCE_PREDETERMINADO_ROL para que cualquier rol que se agregue a esos niveles
// quede incluido sin tocar esta lista.
const SECTION_OR_REGION_LEVEL_ROLES = new Set(
  Object.entries(ALCANCE_PREDETERMINADO_ROL)
    .filter(([, alcance]) => alcance === ALCANCES.SECCION || alcance === ALCANCES.REGION)
    .map(([rolId]) => rolId)
);

// Navegacion de la ESTRUCTURA (contadores de secciones y destacamentos) en las
// listas de niveles: los cargos seccionales y regionales pueden abrirla para
// CUALQUIER entidad, no solo la propia. Es consulta de estructura, no de personas:
// el contador de MIEMBROS sigue acotado por `isForeign*ForMembers`.
export const canBrowseOrgStructureCounts = (user = {}) =>
  isUnrestrictedOrgViewer(user) || SECTION_OR_REGION_LEVEL_ROLES.has(getOrgRoleId(user));

// Cargo de nivel seccion o region (sin incluir los nacionales). Se usa para los
// textos de la ficha del miembro, donde el motivo de la restriccion es distinto
// al del Consejo Nacional.
export const isSectionOrRegionLevelRole = (user = {}) =>
  SECTION_OR_REGION_LEVEL_ROLES.has(getOrgRoleId(user));

// Cargos de nivel SECCION (Coordinador Seccional, su asistente, los coordinadores
// de area seccional y los cargos de consulta seccional).
const SECTION_LEVEL_ROLES = new Set(
  Object.entries(ALCANCE_PREDETERMINADO_ROL)
    .filter(([, alcance]) => alcance === ALCANCES.SECCION)
    .map(([rolId]) => rolId)
);

// Excepcion sobre `canBrowseOrgStructureCounts`: los cargos seccionales navegan
// las SECCIONES de cualquier region, pero los DESTACAMENTOS solo los de su propia
// region. Los cargos regionales y los supervisores plenos no tienen este limite.
export const isSectionLevelRole = (user = {}) =>
  !isUnrestrictedOrgViewer(user) && SECTION_LEVEL_ROLES.has(getOrgRoleId(user));

// Los `ownRegionIds`/`ownSectionIds`/`ownDestIds` son opcionales: cuando la vista
// los calcula (incluyendo la DERIVACION desde el destacamento/seccion del
// usuario) se usan esos; si no, se cae al alcance explicito del token. Esto es lo
// que permite que un cargo de destacamento reconozca su propia region/seccion.
export const isForeignRegionForMembers = (user = {}, { regionId, ownRegionIds } = {}) => {
  if (isUnrestrictedOrgViewer(user)) return false;
  const own = ownRegionIds instanceof Set ? ownRegionIds : getRegionScopeIds(user);
  return !own.has(normalizeId(regionId));
};

export const isForeignSectionForMembers = (
  user = {},
  { sectionId, regionId, ownRegionIds, ownSectionIds } = {}
) => {
  if (isUnrestrictedOrgViewer(user)) return false;
  const ownRegion = ownRegionIds instanceof Set ? ownRegionIds : getRegionScopeIds(user);
  if (ownRegion.has(normalizeId(regionId))) return false;
  const ownSection = ownSectionIds instanceof Set ? ownSectionIds : getSectionScopeIds(user);
  return !ownSection.has(normalizeId(sectionId));
};

export const isForeignDestForMembers = (
  user = {},
  { destId, sectionId, regionId, ownRegionIds, ownSectionIds, ownDestIds } = {}
) => {
  if (isUnrestrictedOrgViewer(user)) return false;

  // El Usuario Comun consulta los destacamentos de toda su seccion, pero los
  // MIEMBROS solo los del suyo. Para el, entonces, que la seccion coincida no
  // abre el contador: se compara unicamente por destacamento. Sin esta salvedad
  // el contador de un destacamento vecino quedaba pulsable y llevaba a una lista
  // vacia, que es peor que verlo deshabilitado.
  if (!esUsuarioComun(user)) {
    const ownRegion = ownRegionIds instanceof Set ? ownRegionIds : getRegionScopeIds(user);
    if (ownRegion.has(normalizeId(regionId))) return false;
    const ownSection = ownSectionIds instanceof Set ? ownSectionIds : getSectionScopeIds(user);
    if (ownSection.has(normalizeId(sectionId))) return false;
  }

  const ownDest = ownDestIds instanceof Set ? ownDestIds : getDestScopeIds(user);
  return !ownDest.has(normalizeId(destId));
};

// La Oficina Nacional es quien aprueba, sugiere o rechaza los cambios propuestos
// sobre destacamentos, secciones, regiones y las directivas de seccion, region y
// consejo nacional. El Administrador Global entra tambien: manda sobre todo.
export const isOficinaNacional = (user = {}) => getOrgRoleId(user) === ROLES.OFICINA_NACIONAL;

export const puedeAprobarCambiosDeOrganizacion = (user = {}) =>
  isOficinaNacional(user) || isAdminGlobal(user);

// Quien entra al area de Administradores (incluido Historial - Logs). Es
// informacion de gobierno de toda la organizacion: no la ve un cargo de
// destacamento ni de seccion por muy coordinador que sea.
export const puedeEntrarAAdministracion = (user = {}) =>
  [ROLES.ADMINISTRADOR_GLOBAL, ROLES.ADMINISTRADOR_FUNCIONAL, ROLES.OFICINA_NACIONAL].includes(
    getOrgRoleId(user)
  );
