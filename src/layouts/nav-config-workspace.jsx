import { CONFIG } from 'src/global-config';

import { ROLES, ROLES_CATALOGO } from 'src/auth/permissions/roles';

// ----------------------------------------------------------------------

// Roles de nivel organizacional que se muestran en el switcher. Se listan por
// codigo (no por nombre) para que sigan apareciendo aunque su nombre ya no
// contenga "administrador".
const CODIGOS_NIVEL_ORG = [
  ROLES.USUARIO_DESTACAMENTO,
  ROLES.USUARIO_SECCION,
  ROLES.USUARIO_REGION,
];

const workspaceRoles = ROLES_CATALOGO.filter(
  (rol) =>
    rol.codigo === ROLES.USUARIO_COMUN ||
    rol.codigo === ROLES.CONSEJO_NACIONAL ||
    // La Oficina Nacional se nombra a mano, como los administradores: no sale de
    // ninguna casilla del organigrama, asi que sin esta linea no habria forma de
    // asignarsela a nadie y las aprobaciones se quedarian sin quien las resuelva.
    rol.codigo === ROLES.OFICINA_NACIONAL ||
    CODIGOS_NIVEL_ORG.includes(rol.codigo) ||
    rol.nombre.toLowerCase().includes('administrador')
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
