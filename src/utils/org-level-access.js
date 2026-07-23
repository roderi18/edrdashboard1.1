import { ROLES, ROLES_POR_CODIGO } from 'src/auth/permissions/roles';

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

export const isGlobalOrgManager = (user = {}) => GLOBAL_MANAGER_ROLES.includes(getOrgRoleId(user));

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
];

// Alias de alcance: cada asistente comparte el alcance de su titular. Los
// permisos concretos (que difieren) se controlan en PERMISOS_POR_ROL; aqui solo
// se decide el "propio vs ajeno" segun el nivel.
const REGION_SCOPED_ROLES = [ROLES.USUARIO_REGION, ROLES.USUARIO_REGION_ASISTENTE];
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

const getDestScopeIds = (user = {}) => {
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

const getRegionalOwnId = (regional = {}) =>
  normalizeId(regional?.idRegion ?? regional?.id ?? regional?.regionId ?? regional?.regionalId);

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

export const canEditRegional = (user = {}, regional = {}) => {
  if (isGlobalOrgManager(user)) return true;

  if (getOrgRoleId(user) === ROLES.USUARIO_REGION) {
    const regionId = getRegionalOwnId(regional);
    return Boolean(regionId) && getRegionScopeIds(user).has(regionId);
  }

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

// Admin de region crea secciones dentro de su region. Si no se pasa regionId,
// responde si el rol tiene alguna region en su alcance (para mostrar el boton).
export const canCreateSectionalInRegion = (user = {}, regionId = null) => {
  if (isGlobalOrgManager(user)) return true;

  if (REGION_SCOPED_ROLES.includes(getOrgRoleId(user))) {
    const scope = getRegionScopeIds(user);
    return regionId === null ? scope.size > 0 : scope.has(normalizeId(regionId));
  }

  return false;
};

// Admin de seccion crea destacamentos dentro de su seccion. El admin de region
// NO crea destacamentos (solo los edita).
export const canCreateDestInSection = (user = {}, sectionId = null) => {
  if (isGlobalOrgManager(user)) return true;

  if (SECTION_SCOPED_ROLES.includes(getOrgRoleId(user))) {
    const scope = getSectionScopeIds(user);
    return sectionId === null ? scope.size > 0 : scope.has(normalizeId(sectionId));
  }

  return false;
};

// Valida el destino al guardar una seccion: el admin de region solo puede
// asignarla a una region de su alcance; el admin de seccion edita su propia
// seccion sin reasignarla fuera (su alcance es por id de seccion, no por region).
export const canAssignSectionalToRegion = (user = {}, regionId = null) => {
  if (isFullOrgManager(user)) return true;

  const roleId = getOrgRoleId(user);

  if (REGION_SCOPED_ROLES.includes(roleId)) {
    return getRegionScopeIds(user).has(normalizeId(regionId));
  }

  if (roleId === ROLES.USUARIO_SECCION) {
    return true;
  }

  return false;
};

// ----------------------------------------------------------------------
// Eliminacion: reservada a los administradores global/funcional.
// ----------------------------------------------------------------------

export const canDeleteOrgLevel = (user = {}) => isGlobalOrgManager(user);
