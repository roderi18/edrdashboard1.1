import { ROLES, ROLES_POR_CODIGO } from 'src/auth/permissions/roles';

import { normalizeText } from './normalize-text';

// ----------------------------------------------------------------------

export const ADMIN_ROLE_IDS = [
  ROLES.USUARIO_DESTACAMENTO,
  ROLES.USUARIO_SECCION,
  ROLES.USUARIO_REGION,
  ROLES.ADMINISTRADOR_GLOBAL,
  ROLES.ADMINISTRADOR_FUNCIONAL,
  ROLES.ADMINISTRADOR_TIENDA,
];

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

export const getAdminRoleLabel = (user = {}) => {
  const roleName = getAdminRoleName(user);
  const normalizedRole = normalizeText(roleName);
  const scope = user?.alcance || {};
  const scopeType = scope?.tipo || scope?.modo || '';

  if (normalizedRole.includes('destacamento')) {
    const value =
      getScopeValue(scope, 'destacamento') ||
      user?.destacamentoId ||
      user?.idDestacamento ||
      user?.destId ||
      '';

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
