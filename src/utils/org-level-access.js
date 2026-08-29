import { alcanceQueMandaAhora } from 'src/utils/modulo-activo';

import { PERMISOS } from 'src/auth/permissions/permissions';
import { ROLES, ALCANCES, ROLES_POR_CODIGO } from 'src/auth/permissions/roles';
import {
  PERMISOS_POR_ROL,
  ALCANCE_PREDETERMINADO_ROL,
} from 'src/auth/permissions/role-permissions';

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

// Cargos que mandan en TODOS los modulos: la dominancia por modulo no les quita
// el mando porque no hay nivel por encima del suyo.
const ROLES_SIN_DOMINANCIA_POR_MODULO = [
  ROLES.ADMINISTRADOR_GLOBAL,
  ROLES.ADMINISTRADOR_FUNCIONAL,
  ROLES.OFICINA_NACIONAL,
];

const codigoDeRolPrincipal = (user = {}) => {
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

/**
 * El rol con el que se decide AQUI.
 *
 * Quien ejerce dos cargos entra con el de mayor nivel, pero dentro de un modulo
 * manda el cargo de ESE nivel: sobre los miembros y los destacamentos decide su
 * cargo de destacamento, en Secciones el seccional y en Regiones el regional.
 * Sin esto, una casilla en la seccion —donde no se edita a nadie— le quitaba al
 * Coordinador de Destacamento la edicion de los suyos.
 */
export const getOrgRoleId = (user = {}) => {
  const principal = codigoDeRolPrincipal(user);
  const alcance = alcanceQueMandaAhora();

  if (!alcance) return principal;

  const codigos = [
    principal,
    ...(Array.isArray(user?.cargos) ? user.cargos : []).map((cargo) =>
      String(cargo?.rol ?? cargo?.rolId ?? cargo?.codigo ?? '')
        .trim()
        .toLowerCase()
    ),
  ].filter(Boolean);

  if (codigos.some((codigo) => ROLES_SIN_DOMINANCIA_POR_MODULO.includes(codigo))) {
    return principal;
  }

  return codigos.find((codigo) => ALCANCE_PREDETERMINADO_ROL[codigo] === alcance) || principal;
};

/**
 * Todos los cargos que la persona ejerce, en codigo de catalogo.
 *
 * El rol principal es solo el de MAYOR nivel. Quien es Coordinador en su
 * destacamento y ademas ocupa una casilla en su seccion o region entra con el
 * segundo, y preguntar unicamente por el le borraba lo que hace en el suyo.
 */
export const rolesQueEjerce = (user = {}) => {
  const deSusCargos = (Array.isArray(user?.cargos) ? user.cargos : []).map((cargo) =>
    String(cargo?.rol ?? cargo?.rolId ?? cargo?.codigo ?? '')
      .trim()
      .toLowerCase()
  );

  return [...new Set([getOrgRoleId(user), ...deSusCargos].filter(Boolean))];
};

// Un miembro sin cargo es un Usuario Comun: su sesion guarda `rol: 'miembro'`,
// que no es un codigo del catalogo, asi que getOrgRoleId devuelve vacio. Se
// resuelve aqui en vez de importar member-access, que no depende de este modulo
// y conviene que siga sin hacerlo.
const esUsuarioComun = (user = {}) => {
  const roleId = getOrgRoleId(user);

  if (roleId === ROLES.USUARIO_COMUN) return true;

  const esAdmin = ['admin', 'administrador'].includes(
    String(user?.role ?? user?.rol ?? '')
      .trim()
      .toLowerCase()
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
// TODOS los cargos de nivel region, no solo el Coordinador y su Sub-Director:
// el de Adiestramiento, el de Promocion, el de Produccion, el de Programa, el
// Capellan y el Secretario Regional. Se deriva del alcance del catalogo en vez
// de escribirse a mano, para que un cargo regional nuevo no nazca fuera.
//
// Siguen siendo cargos de CONSULTA: no editan lo que ya existe. Lo que se les
// abre es dar de alta —y lo que den de alta lo aprueba la Oficina Nacional—.
const REGION_CREATOR_ROLES = Object.entries(ALCANCE_PREDETERMINADO_ROL)
  .filter(([, alcance]) => alcance === ALCANCES.REGION)
  .map(([codigo]) => codigo);

// Cargos que pueden COMPONER una directiva mediante propuesta. El alcance de
// seccion y region se comprueba contra la entidad concreta; los cargos del
// Consejo Ejecutivo puede proponer en cualquier entidad del pais.
// Oficina Nacional queda fuera porque revisa y aplica las propuestas.
const SECTION_LEADERSHIP_PROPOSER_ROLES = Object.entries(ALCANCE_PREDETERMINADO_ROL)
  .filter(([, alcance]) => alcance === ALCANCES.SECCION)
  .map(([codigo]) => codigo);
const REGION_LEADERSHIP_PROPOSER_ROLES = Object.entries(ALCANCE_PREDETERMINADO_ROL)
  .filter(([, alcance]) => alcance === ALCANCES.REGION)
  .map(([codigo]) => codigo);
// Consejo Ejecutivo mostrado en el organigrama nacional. Solo estos diez cargos
// reciben alcance para proponer en TODAS las regiones, secciones y destacamentos;
// no se concede por el mero hecho de tener cualquier etiqueta nacional.
const NATIONAL_LEADERSHIP_PROPOSER_ROLES = [
  ROLES.MINISTERIOS_INFANTILES_NACIONAL,
  ROLES.DIRECTOR_NACIONAL,
  ROLES.CAPELLAN_NACIONAL,
  ROLES.COORDINADOR_ADIESTRAMIENTO_NACIONAL,
  ROLES.SUBDIRECTOR_NACIONAL,
  ROLES.COORDINADOR_PROMOCION_NACIONAL,
  ROLES.COORDINADOR_PRODUCCION_NACIONAL,
  ROLES.COORDINADOR_PROGRAMA_NACIONAL,
  ROLES.COMITES_ESPECIALES_NACIONAL,
  ROLES.OFICIALES_ADIESTRAMIENTOS_ESPECIALES_NACIONAL,
];
const DEST_LEADERSHIP_DIRECT_ROLES = Object.entries(ALCANCE_PREDETERMINADO_ROL)
  .filter(
    ([codigo, alcance]) =>
      alcance === ALCANCES.DESTACAMENTO &&
      (PERMISOS_POR_ROL[codigo] ?? []).includes(PERMISOS.MIEMBROS_EDITAR)
  )
  .map(([codigo]) => codigo);

// Por todos sus cargos: quien coordina su destacamento y ademas ocupa una
// casilla en su region entraba con el de destacamento y perdia lo de la region.
export const isRegionScopedCreator = (user = {}) =>
  rolesQueEjerce(user).some((codigo) => REGION_CREATOR_ROLES.includes(codigo));

const isAdminSession = (user = {}) =>
  ['admin', 'administrador'].includes(
    String(user?.role ?? user?.rol ?? '')
      .trim()
      .toLowerCase()
  );

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

export const esProponenteNacionalDeDirectivas = (user = {}) => {
  const principal = getOrgRoleId(user);

  if ([ROLES.OFICINA_NACIONAL, ROLES.ADMINISTRADOR_GLOBAL].includes(principal)) return false;

  return rolesQueEjerce(user).some((codigo) => NATIONAL_LEADERSHIP_PROPOSER_ROLES.includes(codigo));
};

// La directiva local conserva su flujo directo para los siete cargos de
// destacamento, pero solo dentro de la entidad exacta de su cargo.
export const canManageDestLeadershipDirectly = (user = {}, destId = null) => {
  if (isAdminGlobal(user)) return true;

  const id = normalizeId(destId);

  return (
    Boolean(id) &&
    getDestScopeIds(user).has(id) &&
    rolesQueEjerce(user).some((codigo) => DEST_LEADERSHIP_DIRECT_ROLES.includes(codigo))
  );
};

export const canManageSectionLeadership = (user = {}, sectionId = null) => {
  if (isAdminGlobal(user) || esProponenteNacionalDeDirectivas(user)) return true;

  const id = normalizeId(sectionId);

  return (
    Boolean(id) &&
    getSectionScopeIds(user).has(id) &&
    rolesQueEjerce(user).some((codigo) => SECTION_LEADERSHIP_PROPOSER_ROLES.includes(codigo))
  );
};

export const canManageNationalLeadership = (user = {}) =>
  isAdminGlobal(user) || esProponenteNacionalDeDirectivas(user);

// --- Lectura de ids desde las filas/entidades ---

const getSectionalOwnId = (sectional = {}) =>
  normalizeId(sectional?.idSeccion ?? sectional?.id ?? sectional?.sectionalId);

const getSectionalRegionId = (sectional = {}) =>
  normalizeId(sectional?.regionalId ?? sectional?.idRegion ?? sectional?.regionId);

const getDestSectionId = (dest = {}) =>
  normalizeId(dest?.sectionalId ?? dest?.idSeccion ?? dest?.seccionId ?? dest?.sectionId);

const getDestRegionId = (dest = {}) =>
  normalizeId(dest?.regionalId ?? dest?.idRegion ?? dest?.regionId);

const getDestOwnId = (dest = {}) => normalizeId(dest?.id ?? dest?.idDestacamento ?? dest?.destId);

// ----------------------------------------------------------------------
// Edicion por entidad
// ----------------------------------------------------------------------

export const canEditRegional = (user = {}) => {
  // Editar regiones queda reservado a los administradores global/funcional. Los
  // cargos regionales pasaron a consulta de solo lectura.
  if (isGlobalOrgManager(user)) return true;

  return false;
};

/**
 * Quien puede SUGERIR la foto de su region.
 *
 * El Coordinador Regional y su Asistente NO editan la region —son cargos de
 * consulta—, pero la imagen de su region la conocen antes que nadie, y sugerir
 * no es cambiar: lo que suben espera a la Oficina Nacional igual que la foto de
 * una seccion o de un destacamento.
 *
 * Se miran TODOS sus cargos: quien ademas es Coordinador en su destacamento
 * entraba con ese y perdia lo que le toca en su region.
 */
// Coordinador de Destacamento y su Asistente: los dueños de la directiva de su
// destacamento. Lo que hacen ahi no le pide permiso a nadie.
const DUENOS_DE_LA_DIRECTIVA_DEL_DESTACAMENTO = [
  ROLES.USUARIO_DESTACAMENTO,
  ROLES.USUARIO_DESTACAMENTO_ASISTENTE,
];

/**
 * ¿Su cambio en la directiva del destacamento hay que avisarselo al Coordinador?
 *
 * Si lo mueve el Coordinador o su Asistente, no: es su casa. Cualquier otro
 * cargo que llegue a componerla —Pastor, Consejo, Capellan, Lider de Grupo y su
 * Asistente— puede hacerlo, pero no a espaldas de quien responde por el
 * destacamento. Vive aqui y no en `member-access` para no cerrar un ciclo: el
 * servicio de directivas es quien pregunta, y `member-access` le importa cosas.
 */
export const destLeadershipChangeNeedsNotice = (user = {}) => {
  if (isAdminGlobal(user)) return false;

  return !rolesQueEjerce(user).some((codigo) =>
    DUENOS_DE_LA_DIRECTIVA_DEL_DESTACAMENTO.includes(codigo)
  );
};

/**
 * ¿Puede decir a que REGION pertenece una seccion?
 *
 * Ningun cargo de SECCION: ni cambiandola ni sugiriendolo. Una seccion no se
 * muda de region por decision de quien la coordina —eso lo decide el nivel de
 * arriba—, y como la ficha de la seccion viaja a la Oficina Nacional, dejar el
 * desplegable vivo era ofrecerle mandar una propuesta que nadie le pidio.
 *
 * Se miran TODOS sus cargos: recibir una casilla seccional cierra el
 * desplegable aunque su cargo principal sea otro.
 */
/**
 * ¿Lo que da de alta esta persona entra como SUGERENCIA?
 *
 * Un cargo de SECCION puede dar de alta destacamentos en su seccion, pero no
 * habla por la organizacion: lo suyo se registra como sugerido y no se aplica
 * solo. Es la misma distincion que ya se hace al editar la seccion (ver
 * `soloSugiereCambiosDeSeccion`), llevada al alta.
 */
/**
 * ¿Puede componer la directiva de ESA region?
 *
 * Cualquier cargo de nivel region, dentro de SU region, puede proponer cambios.
 * Ninguno los aplica directamente: todos quedan PENDIENTES de la Oficina
 * Nacional o del Administrador Global. Los cargos del Consejo Ejecutivo pueden
 * proponer en cualquier region.
 */
export const canManageRegionLeadership = (user = {}, regionId = null) => {
  if (isAdminGlobal(user) || esProponenteNacionalDeDirectivas(user)) return true;

  if (!rolesQueEjerce(user).some((codigo) => REGION_LEADERSHIP_PROPOSER_ROLES.includes(codigo))) {
    return false;
  }

  const id = normalizeId(regionId);

  return Boolean(id) && getRegionScopeIds(user).has(id);
};

export const soloSugiereAltasDeDestacamento = (user = {}) => {
  if (puedeAprobarCambiosDeOrganizacion(user)) return false;

  return rolesQueEjerce(user).some((codigo) => SECTION_SCOPED_ROLES.includes(codigo));
};

export const puedeAsignarLaRegionDeUnaSeccion = (user = {}) => {
  if (isGlobalOrgManager(user)) return true;

  const cargos = Array.isArray(user?.cargos) ? user.cargos : [];

  if (cargos.some((cargo) => String(cargo?.nivel ?? '') === 'seccional')) return false;

  return !rolesQueEjerce(user).some(
    (codigo) => ALCANCE_PREDETERMINADO_ROL[codigo] === ALCANCES.SECCION
  );
};

export const puedeSugerirFotoDeRegion = (user = {}, region = {}) => {
  if (isGlobalOrgManager(user)) return true;

  if (!rolesQueEjerce(user).some((codigo) => REGION_CREATOR_ROLES.includes(codigo))) return false;

  const regionId = normalizeId(region?.id ?? region?.idRegion ?? region?.regionId);

  return Boolean(regionId) && getRegionScopeIds(user).has(regionId);
};

export const canEditSectional = (user = {}, sectional = {}) => {
  if (isGlobalOrgManager(user)) return true;

  const roleId = getOrgRoleId(user);

  // Director Regional y su Sub-Director editan secciones de su region.
  if (REGION_SCOPED_ROLES.includes(roleId)) {
    const regionId = getSectionalRegionId(sectional);
    return Boolean(regionId) && getRegionScopeIds(user).has(regionId);
  }

  // El Coordinador Seccional y su Sub-Coordinador editan SU seccion. El
  // Sub-Coordinador llega hasta los mismos campos que el titular: la diferencia
  // no esta en lo que puede tocar, sino en que lo suyo entra como SUGERENCIA
  // (ver `soloSugiereCambiosDeSeccion`). Cerrarle el formulario lo dejaba sin
  // manera de proponer nada, que no es lo mismo que no poder decidirlo.
  //
  // Se miran TODOS sus cargos y no solo el principal: quien es Coordinador
  // Asistente en su destacamento y ademas Sub-Coordinador en su seccion entraba
  // con el cargo de destacamento y perdia lo que hace en la suya.
  if (rolesQueEjerce(user).some((codigo) => SECTION_SCOPED_ROLES.includes(codigo))) {
    const sectionId = getSectionalOwnId(sectional);
    return Boolean(sectionId) && getSectionScopeIds(user).has(sectionId);
  }

  return false;
};

/**
 * ¿Lo suyo es una SUGERENCIA y no una propuesta?
 *
 * El Sub-Coordinador Seccional maneja los mismos campos que su Coordinador, pero
 * no habla por la seccion: lo que envia queda registrado como sugerido, y no se
 * aplica solo ni aunque quien lo mande pudiera aprobar.
 */
export const soloSugiereCambiosDeSeccion = (user = {}) => {
  if (puedeAprobarCambiosDeOrganizacion(user)) return false;

  const suyos = rolesQueEjerce(user);

  if (suyos.includes(ROLES.USUARIO_SECCION)) return false;

  return suyos.includes(ROLES.USUARIO_SECCION_ASISTENTE);
};

export const canEditDest = (user = {}, dest = {}) => {
  if (isFullOrgManager(user)) return true;

  // Se miran TODOS sus cargos: cada uno abre su propia puerta, y el alcance de
  // cada puerta —su region, su seccion, su destacamento— sigue siendo el que era.
  const suyos = rolesQueEjerce(user);
  const ejerce = (lista) => suyos.some((codigo) => lista.includes(codigo));

  if (ejerce(REGION_SCOPED_ROLES)) {
    const regionId = getDestRegionId(dest);

    if (Boolean(regionId) && getRegionScopeIds(user).has(regionId)) return true;
  }

  if (ejerce(SECTION_SCOPED_ROLES)) {
    const sectionId = getDestSectionId(dest);

    if (Boolean(sectionId) && getSectionScopeIds(user).has(sectionId)) return true;
  }

  if (ejerce(DEST_SCOPED_ROLES)) {
    const destId = getDestOwnId(dest);

    if (Boolean(destId) && getDestScopeIds(user).has(destId)) return true;
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

  const esCreadorRegional = rolesQueEjerce(user).some(
    (codigo) => REGION_SCOPED_ROLES.includes(codigo) || REGION_CREATOR_ROLES.includes(codigo)
  );

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

  // Por todos sus cargos, igual que el resto de los guardas de esta casa.
  const suyos = rolesQueEjerce(user);

  if (suyos.some((codigo) => SECTION_SCOPED_ROLES.includes(codigo))) {
    if (sectionId === null) return true;

    const scope = ownSectionIds instanceof Set ? ownSectionIds : getSectionScopeIds(user);

    return scope.has(normalizeId(sectionId));
  }

  if (suyos.some((codigo) => REGION_CREATOR_ROLES.includes(codigo))) {
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

  // El Coordinador Seccional y su Sub-Coordinador editan su propia seccion sin
  // reasignarla: su alcance es por id de seccion, no por region.
  if (rolesQueEjerce(user).some((codigo) => SECTION_SCOPED_ROLES.includes(codigo))) {
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
// Los niveles que ven TODAS las regiones. Los de nivel region las ven todas
// —dentro de la suya mandan, las demas las consultan— y los de nivel nacional
// (Consejo Nacional y sus cargos, Consejo Ejecutivo y Oficina Nacional) tambien.
const NIVELES_CON_TODAS_LAS_REGIONES = [ALCANCES.REGION, ALCANCES.NACIONAL];

/**
 * ¿Ve TODAS las regiones, y puede entrar en cualquiera?
 *
 * Los cargos de nivel region y de nivel nacional, mas los administradores Global
 * y Funcional (y una sesion de administrador legada). El Administrador de Tienda
 * queda fuera aunque su alcance sea global por catalogo: no gobierna la
 * estructura.
 *
 * Para todos los demas —cargos de destacamento, de seccion, Pastor y Usuario
 * Comun— las otras regiones se LISTAN pero salen deshabilitadas, y su ficha no
 * se abre ni escribiendo el enlace a mano: eso lo aplica `puedeEntrarALaRegion`.
 *
 * Se miran TODOS sus cargos, no solo el principal.
 */
export const puedeVerTodasLasRegiones = (user = {}) =>
  isFullOrgManager(user) ||
  rolesQueEjerce(user).some((codigo) =>
    NIVELES_CON_TODAS_LAS_REGIONES.includes(ALCANCE_PREDETERMINADO_ROL[codigo])
  );

/**
 * ¿Puede ABRIR la ficha de esta region?
 *
 * Quien las ve todas, en cualquiera; el resto, solo en la suya. Es la puerta que
 * hay que cerrar en la pantalla, porque la lista deshabilitada no impide llegar
 * con el enlace pegado.
 *
 * `ownRegionIds` es opcional: cuando la pantalla ya lo calculo —derivando la
 * region desde el destacamento o la seccion propios— se usa ese; si no, se cae
 * al alcance explicito del token, que un cargo de destacamento no trae.
 */
export const puedeEntrarALaRegion = (user = {}, regionId = null, { ownRegionIds } = {}) => {
  if (puedeVerTodasLasRegiones(user)) return true;

  const id = normalizeId(regionId);
  const own = ownRegionIds instanceof Set ? ownRegionIds : getRegionScopeIds(user);

  return Boolean(id) && own.has(id);
};

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
  // Que la region coincida solo abre el contador a quien ve los miembros de la
  // region entera. Un cargo SECCIONAL ve las secciones de su region, pero su
  // gente llega hasta la suya: en las demas el contador lleva a una lista vacia.
  const nivel = nivelDeSusCargosSobreElDestacamento(user);
  const ownRegion = ownRegionIds instanceof Set ? ownRegionIds : getRegionScopeIds(user);
  if (nivel !== ALCANCES.SECCION && ownRegion.has(normalizeId(regionId))) return false;
  const ownSection = ownSectionIds instanceof Set ? ownSectionIds : getSectionScopeIds(user);
  return !ownSection.has(normalizeId(sectionId));
};

/**
 * ¿Trabaja esta persona a nivel de UN destacamento?
 *
 * Lo es el Usuario Comun y cualquier cargo de destacamento. Se miran TODOS sus
 * cargos, no solo el principal: quien es Coordinador Asistente en su
 * destacamento y ademas Sub Coordinador en su seccion sigue siendo un cargo de
 * destacamento, y lo de los demas destacamentos no le toca.
 */
export const esRolDeDestacamento = (user = {}) => {
  const cargos = Array.isArray(user?.cargos) ? user.cargos : [];

  if (cargos.some((cargo) => String(cargo?.nivel ?? '') === 'destacamento')) return true;

  return ALCANCE_PREDETERMINADO_ROL[getOrgRoleId(user)] === ALCANCES.DESTACAMENTO;
};

// Los niveles POR ENCIMA del destacamento, de menor a mayor.
const NIVELES_SOBRE_EL_DESTACAMENTO = [ALCANCES.SECCION, ALCANCES.REGION, ALCANCES.NACIONAL];

/**
 * El nivel MAS AMPLIO de todos los cargos que ejerce, por encima del suyo.
 *
 * Es hasta donde llega su gente: un cargo de seccion mira a los miembros de
 * todos los destacamentos de su seccion, uno de region a los de su region y el
 * Consejo Nacional a los del pais. Devuelve '' para quien no tiene ningun cargo
 * por encima del destacamento.
 *
 * Se miran TODOS sus cargos y no solo el principal: quien coordina su
 * destacamento y ademas ocupa una casilla en la seccion mira a los de la
 * seccion entera. Los cargos globales no entran: a quien ve toda la
 * organizacion lo decide `puedeVerMiembrosDeTodaLaOrganizacion`, y el
 * Administrador de Tienda —global por catalogo— no tiene por que leer el padron.
 */
export const nivelDeSusCargosSobreElDestacamento = (user = {}) =>
  rolesQueEjerce(user).reduce((masAmplio, codigo) => {
    const nivel = ALCANCE_PREDETERMINADO_ROL[codigo];

    return NIVELES_SOBRE_EL_DESTACAMENTO.indexOf(nivel) >
      NIVELES_SOBRE_EL_DESTACAMENTO.indexOf(masAmplio)
      ? nivel
      : masAmplio;
  }, '');

/** ¿Ejerce algun cargo por encima del destacamento (seccion, region o nacional)? */
export const ejerceCargoSobreDestacamento = (user = {}) =>
  Boolean(nivelDeSusCargosSobreElDestacamento(user));

export const isForeignDestForMembers = (
  user = {},
  { destId, sectionId, regionId, ownRegionIds, ownSectionIds, ownDestIds } = {}
) => {
  if (isUnrestrictedOrgViewer(user)) return false;

  // El contador se abre exactamente donde llega su gente, para que pulsarlo
  // nunca lleve a una lista vacia. Va en par con `filterMembersByMemberScope`.
  const nivel = nivelDeSusCargosSobreElDestacamento(user);

  // Nivel nacional: para el Consejo Nacional y el Ejecutivo no hay destacamento
  // ajeno.
  if (nivel === ALCANCES.NACIONAL) return false;

  // El Usuario Comun consulta los destacamentos de toda su seccion, pero los
  // MIEMBROS solo los del suyo. Para el, entonces, que la seccion coincida no
  // abre el contador: se compara unicamente por destacamento. Sin esta salvedad
  // el contador de un destacamento vecino quedaba pulsable y llevaba a una lista
  // vacia, que es peor que verlo deshabilitado. Lo mismo vale para los cargos de
  // destacamento, que tampoco salen del suyo.
  if (!esUsuarioComun(user)) {
    // La region solo cuenta para un cargo REGIONAL. El seccional consulta los
    // destacamentos de toda su region —eso es estructura—, pero su gente llega
    // hasta su seccion.
    if (nivel === ALCANCES.REGION) {
      const ownRegion = ownRegionIds instanceof Set ? ownRegionIds : getRegionScopeIds(user);
      if (ownRegion.has(normalizeId(regionId))) return false;
    }

    if (nivel === ALCANCES.SECCION || nivel === ALCANCES.REGION) {
      const ownSection = ownSectionIds instanceof Set ? ownSectionIds : getSectionScopeIds(user);
      if (ownSection.has(normalizeId(sectionId))) return false;
    }
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
