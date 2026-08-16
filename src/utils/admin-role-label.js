import { ROLES, ROLES_POR_CODIGO } from 'src/auth/permissions/roles';

import { normalizeText } from './normalize-text';

// ----------------------------------------------------------------------

export const ADMIN_ROLE_IDS = [
  // Nivel destacamento: titular y todos los cargos que comparten su perfil
  // (asistente, pastor, consejo, capellan, lideres de grupo).
  ROLES.USUARIO_DESTACAMENTO,
  ROLES.USUARIO_DESTACAMENTO_ASISTENTE,
  ROLES.PASTOR_DESTACAMENTO,
  ROLES.CONSEJO_DESTACAMENTO,
  ROLES.CAPELLAN_DESTACAMENTO,
  ROLES.LIDER_GRUPO,
  ROLES.LIDER_ASISTENTE_GRUPO,
  // Nivel seccion: titular, asistente y coordinadores de area.
  ROLES.USUARIO_SECCION,
  ROLES.USUARIO_SECCION_ASISTENTE,
  ROLES.COORDINADOR_ADIESTRAMIENTO_SECCION,
  ROLES.COORDINADOR_PROMOCION_SECCION,
  ROLES.COORDINADOR_PRODUCCION_SECCION,
  ROLES.COORDINADOR_PROGRAMA_SECCION,
  // Nivel region: titular, asistente y coordinadores de area.
  ROLES.USUARIO_REGION,
  ROLES.USUARIO_REGION_ASISTENTE,
  ROLES.COORDINADOR_ADIESTRAMIENTO_REGION,
  ROLES.COORDINADOR_PROMOCION_REGION,
  ROLES.COORDINADOR_PRODUCCION_REGION,
  ROLES.COORDINADOR_PROGRAMA_REGION,
  // Cargos de consulta (solo lectura): Capellán Regional y Secretario Regional son
  // de nivel región; los demás de nivel sección. Comparten la construcción de
  // sesión admin con sus hermanos de nivel.
  ROLES.CAPELLAN_REGIONAL,
  ROLES.SECRETARIO_REGIONAL,
  ROLES.CAPELLAN_SECCIONAL,
  ROLES.ZONAS,
  ROLES.GRUPOS_LOCALES,
  // Administradores.
  ROLES.ADMINISTRADOR_GLOBAL,
  ROLES.ADMINISTRADOR_FUNCIONAL,
  ROLES.ADMINISTRADOR_TIENDA,
];

const getRoleId = (user = {}) => {
  const rawRole = String(user?.rol || user?.role || '').trim();

  return String(
    user?.rolId ||
      user?.roleId ||
      user?.rolCodigo ||
      user?.roleCodigo ||
      (ROLES_POR_CODIGO[rawRole] ? rawRole : '')
  )
    .trim()
    .toLowerCase();
};

// Solo los administradores global y funcional pueden modificar los niveles
// organizacionales superiores (secciones, regiones y consejo nacional). El resto
// de los roles los consultan en modo de solo lectura.
export const canManageOrgLevels = (user = {}) =>
  [ROLES.ADMINISTRADOR_GLOBAL, ROLES.ADMINISTRADOR_FUNCIONAL].includes(getRoleId(user));

export const isDestacamentoAdminRole = (user = {}) => {
  const rawRole = String(user?.rol || user?.role || '').trim();
  const roleId =
    user?.rolId ||
    user?.roleId ||
    user?.rolCodigo ||
    user?.roleCodigo ||
    (ROLES_POR_CODIGO[rawRole] ? rawRole : '');

  // El Coordinador Asistente se comporta al 100% como el titular. El Pastor se
  // incluye a nivel de gating de UI (mismo destacamento): oculta filtros de
  // alcance y bloquea la edicion de la directiva; su acceso es de SOLO LECTURA por
  // carecer de permisos de edicion.
  return (
    roleId === ROLES.USUARIO_DESTACAMENTO ||
    roleId === ROLES.USUARIO_DESTACAMENTO_ASISTENTE ||
    roleId === ROLES.PASTOR_DESTACAMENTO
  );
};

export const getAdminRoleName = (user = {}) => {
  const rawRole = String(user?.rol || user?.role || '').trim();
  const roleId =
    user?.rolId ||
    user?.roleId ||
    user?.rolCodigo ||
    user?.roleCodigo ||
    (ROLES_POR_CODIGO[rawRole] ? rawRole : '');
  const roleName =
    user?.rolNombre ||
    user?.roleName ||
    (roleId ? ROLES_POR_CODIGO[roleId]?.nombre : '') ||
    (!['admin', 'administrador'].includes(rawRole.toLowerCase()) ? rawRole : '') ||
    '';

  return roleName || 'Administrador';
};

const getScopeValue = (scope = {}, type) => {
  if (type === 'destacamento') {
    return scope?.destacamentoId || scope?.idDestacamento || scope?.destacamentos?.[0] || '';
  }

  if (type === 'seccion') {
    return scope?.seccionId || scope?.idSeccion || scope?.secciones?.[0] || '';
  }

  if (type === 'region') {
    return scope?.regionId || scope?.idRegion || scope?.regiones?.[0] || '';
  }

  return '';
};

// Numero del destacamento (el que ve el usuario, p. ej. 875) a partir de su id
// interno (219). Devuelve '' si no se puede resolver.
const getDestNumberById = (destId, dests = []) => {
  const id = String(destId ?? '').trim();

  if (!id || !Array.isArray(dests)) return '';

  const dest = dests.find((item) =>
    [item?.id, item?.idDestacamento, item?.destId].some((value) => String(value ?? '') === id)
  );

  return String(dest?.destNumber ?? dest?.numero ?? '').trim();
};

// `dests` es opcional: sin el catalogo no se puede traducir el id a numero y se
// mantiene el comportamiento anterior (mostrar el id).
export const getAdminRoleLabel = (user = {}, { dests = [] } = {}) => {
  const roleName = getAdminRoleName(user);
  const normalizedRole = normalizeText(roleName);
  const scope = user?.alcance || {};
  const scopeType = scope?.tipo || scope?.modo || '';

  if (normalizedRole.includes('destacamento')) {
    const destId =
      getScopeValue(scope, 'destacamento') ||
      user?.destacamentoId ||
      user?.idDestacamento ||
      user?.destId ||
      '';

    // Se muestra el NUMERO del destacamento, no su id interno: el id no significa
    // nada para el usuario y se confundia con un cargo ("Coordinador de
    // Destacamento 219"). Si no se puede resolver, se cae al id como antes.
    const value = getDestNumberById(destId, dests) || destId;

    return value ? `${roleName} ${value}` : roleName;
  }

  if (normalizedRole.includes('seccion')) {
    const value = getScopeValue(scope, 'seccion') || user?.seccionId || user?.idSeccion || '';

    return value ? `${roleName} ${value}` : roleName;
  }

  if (normalizedRole.includes('region')) {
    const value = getScopeValue(scope, 'region') || user?.regionId || user?.idRegion || '';

    return value ? `${roleName} ${value}` : roleName;
  }

  if (scopeType === 'global' && !normalizedRole.includes('global')) {
    return `${roleName} Global`;
  }

  return roleName;
};
