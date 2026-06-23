import { CONFIG } from 'src/global-config';

import { ROLES, ROLES_CATALOGO } from 'src/auth/permissions/roles';

// ----------------------------------------------------------------------

const workspaceRoles = ROLES_CATALOGO.filter(
  (rol) => rol.codigo === ROLES.USUARIO_COMUN || rol.nombre.toLowerCase().includes('administrador')
);

export const _workspaces = workspaceRoles.map((rol, index) => ({
  id: rol.codigo,
  name: rol.nombre,
  plan: rol.alcancePredeterminado,
  badge: rol.codigo === ROLES.USUARIO_COMUN ? 'Comun' : rol.alcancePredeterminado,
  icon: rol.codigo === ROLES.USUARIO_COMUN ? 'solar:user-rounded-bold' : '',
  logo:
    rol.codigo === ROLES.USUARIO_COMUN
      ? ''
      : `${CONFIG.assetsDir}/assets/icons/workspaces/logo-${(index % 3) + 1}.webp`,
  role: rol,
}));
