'use client';

import { usePopover } from 'minimal-shared/hooks';
import { useMemo, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Avatar from '@mui/material/Avatar';
import Tooltip from '@mui/material/Tooltip';
import Popover from '@mui/material/Popover';
import MenuList from '@mui/material/MenuList';
import MenuItem from '@mui/material/MenuItem';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import ButtonBase from '@mui/material/ButtonBase';
import CircularProgress from '@mui/material/CircularProgress';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { Scrollbar } from 'src/components/scrollbar';
import { CustomPopover } from 'src/components/custom-popover';

import { useAuthContext } from 'src/auth/hooks';
import { ROLES, ROLES_POR_CODIGO } from 'src/auth/permissions/roles';
import { cambiarRolPropioDesdeSelector } from 'src/auth/permissions';
import { puedeUsarSelectorDeRol } from 'src/auth/permissions/admin-role-switch-policy';

import { RolePermissionsDialog } from './role-permissions-dialog';

// ----------------------------------------------------------------------

// Cargos organizacionales que se muestran dentro del submenu de cada rol.
// Cada entrada es un objeto: si trae `rolCodigo` es un rol real y seleccionable
// (cambia de sesion); si no, es un cargo aun sin permisos y se muestra
// deshabilitado hasta que se definan.
const SUBROLES_POR_ROL = {
  // "Coordinador de Destacamento" es ahora el rol en si (primer item), por eso
  // no se repite aqui como cargo.
  [ROLES.USUARIO_DESTACAMENTO]: [
    { label: 'Pastor', rolCodigo: ROLES.PASTOR_DESTACAMENTO },
    {
      label: 'Coordinador Asistente de Destacamento',
      rolCodigo: ROLES.USUARIO_DESTACAMENTO_ASISTENTE,
    },
    { label: 'Consejo Destacamento', rolCodigo: ROLES.CONSEJO_DESTACAMENTO },
    { label: 'Capellán', rolCodigo: ROLES.CAPELLAN_DESTACAMENTO },
    { label: 'Líder de Grupo', rolCodigo: ROLES.LIDER_GRUPO },
    { label: 'Líder Asistente de Grupo', rolCodigo: ROLES.LIDER_ASISTENTE_GRUPO },
  ],
  // "Coordinador Seccional" es ahora el rol en si (primer item).
  [ROLES.USUARIO_SECCION]: [
    { label: 'Capellán Seccional', rolCodigo: ROLES.CAPELLAN_SECCIONAL },
    { label: 'Sub-Coordinador Seccional', rolCodigo: ROLES.USUARIO_SECCION_ASISTENTE },
    { label: 'Coordinador de Adiestramiento', rolCodigo: ROLES.COORDINADOR_ADIESTRAMIENTO_SECCION },
    { label: 'Coordinador de Promoción', rolCodigo: ROLES.COORDINADOR_PROMOCION_SECCION },
    { label: 'Coordinador de Producción', rolCodigo: ROLES.COORDINADOR_PRODUCCION_SECCION },
    { label: 'Coordinador de Programa', rolCodigo: ROLES.COORDINADOR_PROGRAMA_SECCION },
    { label: 'Zonas', rolCodigo: ROLES.ZONAS },
    { label: 'Grupos Locales', rolCodigo: ROLES.GRUPOS_LOCALES },
  ],
  // "Coordinador Regional" es ahora el rol en si (primer item).
  [ROLES.USUARIO_REGION]: [
    { label: 'Capellán Regional', rolCodigo: ROLES.CAPELLAN_REGIONAL },
    { label: 'Sub-Director Regional', rolCodigo: ROLES.USUARIO_REGION_ASISTENTE },
    { label: 'Coordinador de Adiestramiento', rolCodigo: ROLES.COORDINADOR_ADIESTRAMIENTO_REGION },
    { label: 'Coordinador de Promoción', rolCodigo: ROLES.COORDINADOR_PROMOCION_REGION },
    { label: 'Coordinador de Producción', rolCodigo: ROLES.COORDINADOR_PRODUCCION_REGION },
    { label: 'Coordinador de Programa', rolCodigo: ROLES.COORDINADOR_PROGRAMA_REGION },
    { label: 'Secretario Regional', rolCodigo: ROLES.SECRETARIO_REGIONAL },
  ],
  [ROLES.CONSEJO_NACIONAL]: [
    { label: 'Ministerios Infantiles', rolCodigo: ROLES.MINISTERIOS_INFANTILES_NACIONAL },
    { label: 'Director Nacional', rolCodigo: ROLES.DIRECTOR_NACIONAL },
    { label: 'Capellán Nacional', rolCodigo: ROLES.CAPELLAN_NACIONAL },
    {
      label: 'Coordinador Nacional de Adiestramiento',
      rolCodigo: ROLES.COORDINADOR_ADIESTRAMIENTO_NACIONAL,
    },
    { label: 'Sub-Director Nacional', rolCodigo: ROLES.SUBDIRECTOR_NACIONAL },
    { label: 'Coordinador Nacional de Promoción', rolCodigo: ROLES.COORDINADOR_PROMOCION_NACIONAL },
    {
      label: 'Coordinador Nacional de Producción',
      rolCodigo: ROLES.COORDINADOR_PRODUCCION_NACIONAL,
    },
    { label: 'Coordinador Nacional de Programa', rolCodigo: ROLES.COORDINADOR_PROGRAMA_NACIONAL },
    { label: 'Comités Especiales', rolCodigo: ROLES.COMITES_ESPECIALES_NACIONAL },
    {
      label: 'Oficiales de Adiestramientos Especiales',
      rolCodigo: ROLES.OFICIALES_ADIESTRAMIENTOS_ESPECIALES_NACIONAL,
    },
  ],
};

// Roles que solo funcionan como agrupador: su submenu muestra unicamente los
// cargos (deshabilitados) y NO incluye el item que cambia de sesion.
const ROLES_SOLO_AGRUPADOR = new Set([ROLES.CONSEJO_NACIONAL]);

// ¿El rol activo es este item o alguno de sus cargos hijos? El padre debe quedar
// resaltado tambien cuando la sesion esta en un sub-rol (p. ej. "Coordinador de
// Adiestramiento" marca ademas a "Coordinador Seccional"), para que el menu
// principal refleje la rama en la que estas y no solo la hoja.
// Un cargo puede colgar de mas de un padre (Secretario Regional aparece bajo
// Seccional y bajo Regional); en ese caso se resaltan ambos, que es lo correcto:
// pertenece a las dos ramas.
const isRoleBranchSelected = (optionId, activeRoleId) => {
  if (!activeRoleId) return false;
  if (optionId === activeRoleId) return true;

  return (SUBROLES_POR_ROL[optionId] ?? []).some((sub) => sub.rolCodigo === activeRoleId);
};

// `disabled`: hay una PAREJA de cargos encendida (ver role-combination-popover).
// El selector se queda a la vista pero TACHADO y apagado: sigue diciendo con que
// rol se entraria, y a la vez que ahora mismo no manda el.
// `nombreForzado`: el rol REAL de la sesion cuando hay una prueba encendida. La
// sesion dice ahora que es un coordinador, pero lo que este selector representa
// —y lo que se recupera al apagar la prueba— es el rol de siempre.
export function WorkspacesPopover({ data = [], sx, disabled = false, nombreForzado = '', ...other }) {
  const mediaQuery = 'sm';

  const { open, anchorEl, onClose, onOpen } = usePopover();

  const { user } = useAuthContext();
  const [loadingRoleId, setLoadingRoleId] = useState('');
  const [submenuAnchor, setSubmenuAnchor] = useState(null);
  const [submenuOption, setSubmenuOption] = useState(null);
  const [permisosRol, setPermisosRol] = useState(null);

  const openPermisos = useCallback((event, rolCodigo, rolNombre) => {
    event.preventDefault();
    event.stopPropagation();
    setPermisosRol({ rolCodigo, rolNombre });
  }, []);

  const closePermisos = useCallback(() => setPermisosRol(null), []);

  const openSubmenu = useCallback((anchor, option) => {
    setSubmenuAnchor(anchor);
    setSubmenuOption(option);
  }, []);

  const closeSubmenu = useCallback(() => {
    setSubmenuAnchor(null);
    setSubmenuOption(null);
  }, []);

  // Este selector pertenece exclusivamente a la cuenta global autorizada. Se
  // comprueba también en el servidor usando el correo del token firmado.
  const puedeCambiarDeRol = puedeUsarSelectorDeRol(user?.email || user?.correo);
  const currentRoleId = user?.rolId || user?.roleId || user?.rolCodigo || user?.roleCodigo || '';
  const selectedWorkspace = useMemo(() => {
    const match = data.find((option) => option.id === currentRoleId);
    if (match) return match;

    // El rol activo puede ser un sub-rol/cargo que no aparece en el switcher
    // (p. ej. "Coordinador Asistente de Destacamento"). En ese caso construimos
    // la opcion desde el catalogo para mostrar su nombre real en el boton, en
    // lugar de caer en data[0] ("Usuario Comun").
    const rolCatalogo = currentRoleId ? ROLES_POR_CODIGO[currentRoleId] : null;
    if (rolCatalogo) {
      return {
        id: rolCatalogo.codigo,
        name: rolCatalogo.nombre,
        plan: rolCatalogo.alcancePredeterminado,
      };
    }

    return data[0];
  }, [currentRoleId, data]);
  const [workspace, setWorkspace] = useState(selectedWorkspace);

  useEffect(() => {
    setWorkspace(selectedWorkspace);
  }, [selectedWorkspace]);

  const handleChangeWorkspace = useCallback(
    async (newValue) => {
      if (!user?.uid) {
        toast.error('No se pudo identificar el usuario actual.');
        return;
      }

      setWorkspace(newValue);
      closeSubmenu();
      onClose();

      try {
        setLoadingRoleId(newValue.id);
        await cambiarRolPropioDesdeSelector({ rolId: newValue.id });

        window.location.reload();
      } catch (error) {
        console.error('[admin-role-switcher] no se pudo asignar el rol', error);
        setLoadingRoleId('');
        toast.error(error?.message || 'No se pudo asignar el tipo de administrador.');
      }
    },
    [closeSubmenu, onClose, user]
  );

  const buttonBg = {
    height: 1,
    zIndex: -1,
    opacity: 0,
    content: "''",
    borderRadius: 1,
    position: 'absolute',
    visibility: 'hidden',
    bgcolor: 'action.hover',
    width: 'calc(100% + 8px)',
    transition: (theme) =>
      theme.transitions.create(['opacity', 'visibility'], {
        easing: theme.transitions.easing.sharp,
        duration: theme.transitions.duration.shorter,
      }),
    ...(open && {
      opacity: 1,
      visibility: 'visible',
    }),
  };

  const renderWorkspaceIcon = (option, iconSx) =>
    option?.icon ? (
      <Box
        sx={[
          {
            width: 24,
            height: 24,
            flexShrink: 0,
            borderRadius: '50%',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'action.selected',
            color: 'text.secondary',
          },
          ...(Array.isArray(iconSx) ? iconSx : [iconSx]),
        ]}
      >
        <Iconify width={16} icon={option.icon} />
      </Box>
    ) : (
      <Avatar alt={option?.name} src={option?.logo} sx={{ width: 24, height: 24 }} />
    );

  const renderButton = () => {
    // Solo el Administrador Global cambia de rol desde aqui. Para el resto, el
    // rol NO se elige: sale del cargo que ocupan en la directiva. Se deja el
    // nombre a la vista —es informacion util— pero sin boton, sin flecha y sin
    // menu: un desplegable que permitiera cambiarse el rol a uno mismo seria una
    // via de escalada de privilegios abierta a cualquiera.
    if (!puedeCambiarDeRol && !disabled) {
      return (
        <Box
          sx={[
            {
              py: 0.5,
              display: 'flex',
              alignItems: 'center',
              gap: { xs: 0.5, [mediaQuery]: 1 },
            },
            ...(Array.isArray(sx) ? sx : [sx]),
          ]}
          {...other}
        >
          {renderWorkspaceIcon(workspace, { bgcolor: 'transparent', color: 'primary.main' })}

          <Box
            component="span"
            sx={{ typography: 'subtitle2', display: { xs: 'none', [mediaQuery]: 'inline-flex' } }}
          >
            {workspace?.name}
          </Box>
        </Box>
      );
    }

    return (
      <ButtonBase
        disableRipple
        disabled={disabled}
        onClick={onOpen}
        sx={[
          {
            py: 0.5,
            gap: { xs: 0.5, [mediaQuery]: 1 },
            '&::before': buttonBg,
            // Tachado ademas de apagado: la opacidad sola se confunde con "esta
            // cargando", y la raya dice que ese rol esta anulado ahora mismo.
            ...(disabled && { opacity: 0.4, textDecoration: 'line-through' }),
          },
          ...(Array.isArray(sx) ? sx : [sx]),
        ]}
        {...other}
      >
        {renderWorkspaceIcon(workspace, { bgcolor: 'transparent', color: 'primary.main' })}

        <Box
          component="span"
          sx={{
            typography: 'subtitle2',
            display: { xs: 'none', [mediaQuery]: 'inline-flex' },
            ...(disabled && { textDecoration: 'line-through' }),
          }}
        >
          {nombreForzado || workspace?.name}
        </Box>

        <Iconify width={16} icon="carbon:chevron-sort" sx={{ color: 'text.disabled' }} />
      </ButtonBase>
    );
  };

  const handleCloseAll = useCallback(() => {
    closeSubmenu();
    onClose();
  }, [closeSubmenu, onClose]);

  // Boton "i" que abre el detalle de permisos del rol. Detiene la propagacion
  // para que no dispare el cambio de sesion del MenuItem que lo contiene.
  const renderInfoButton = (rolCodigo, rolNombre) => (
    <Tooltip title="Ver permisos" arrow>
      <IconButton
        size="small"
        onClick={(event) => openPermisos(event, rolCodigo, rolNombre)}
        onMouseDown={(event) => event.stopPropagation()}
        sx={{ flexShrink: 0, ml: 0.5, color: 'text.secondary' }}
      >
        <Iconify width={18} icon="solar:info-circle-bold" />
      </IconButton>
    </Tooltip>
  );

  // Item seleccionable del submenu (cambia de sesion). Se usa tanto para el
  // titular como para los sub-roles que ya tienen codigo/permisos.
  const renderSwitchMenuItem = (option) => (
    <MenuItem
      key={option.id}
      selected={option.id === workspace?.id}
      disabled={Boolean(loadingRoleId)}
      onClick={() => handleChangeWorkspace(option)}
      sx={{ height: 48, gap: 1 }}
    >
      {option.id === loadingRoleId ? (
        <CircularProgress size={20} sx={{ m: 0.25, flexShrink: 0 }} />
      ) : (
        renderWorkspaceIcon(option)
      )}

      <Typography
        component="span"
        variant="body2"
        sx={{
          flexGrow: 1,
          minWidth: 0,
          lineHeight: 1.3,
          whiteSpace: 'normal',
          fontWeight: 'fontWeightMedium',
        }}
      >
        {option.name}
      </Typography>

      {renderInfoButton(option.id, option.name)}
    </MenuItem>
  );

  const renderSubmenu = () => {
    const subRoles = submenuOption ? SUBROLES_POR_ROL[submenuOption.id] || [] : [];
    const soloAgrupador = submenuOption ? ROLES_SOLO_AGRUPADOR.has(submenuOption.id) : false;

    return (
      <Popover
        open={Boolean(submenuAnchor && submenuOption)}
        anchorEl={submenuAnchor}
        onClose={closeSubmenu}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        sx={{ pointerEvents: 'none' }}
        slotProps={{
          paper: {
            onMouseLeave: closeSubmenu,
            sx: { pointerEvents: 'auto', ml: 0.5, width: 320, maxWidth: 'calc(100vw - 32px)' },
          },
        }}
      >
        <MenuList>
          {!soloAgrupador && submenuOption && renderSwitchMenuItem(submenuOption)}

          {subRoles.map((sub) => {
            const rol = sub.rolCodigo ? ROLES_POR_CODIGO[sub.rolCodigo] : null;

            // Sub-rol con codigo/permisos: seleccionable (cambia de sesion).
            if (rol) {
              return renderSwitchMenuItem({
                id: sub.rolCodigo,
                name: sub.label,
                plan: rol.alcancePredeterminado,
              });
            }

            // Cargo aun sin permisos: deshabilitado.
            return (
              <MenuItem key={sub.label} disabled sx={{ height: 48, gap: 1 }}>
                <Typography
                  component="span"
                  variant="body2"
                  sx={{
                    flexGrow: 1,
                    minWidth: 0,
                    lineHeight: 1.3,
                    whiteSpace: 'normal',
                    fontWeight: 'fontWeightMedium',
                  }}
                >
                  {sub.label}
                </Typography>
              </MenuItem>
            );
          })}
        </MenuList>
      </Popover>
    );
  };

  const renderMenuList = () => (
    <CustomPopover
      open={open}
      anchorEl={anchorEl}
      onClose={handleCloseAll}
      slotProps={{
        arrow: { placement: 'top-left' },
        paper: { sx: { mt: 0.5, ml: -1.55, width: 360, maxWidth: 'calc(100vw - 32px)' } },
      }}
    >
      <Scrollbar sx={{ maxHeight: 'calc(100vh - 96px)' }}>
        <MenuList>
          {data.map((option) => {
            const selected = isRoleBranchSelected(option.id, workspace?.id);
            const loading = option.id === loadingRoleId;
            const hasSubmenu = Boolean(SUBROLES_POR_ROL[option.id]);

            return (
              <MenuItem
                key={option.id}
                selected={selected}
                disabled={Boolean(loadingRoleId)}
                onClick={(event) =>
                  hasSubmenu
                    ? openSubmenu(event.currentTarget, option)
                    : handleChangeWorkspace(option)
                }
                onMouseEnter={(event) =>
                  hasSubmenu ? openSubmenu(event.currentTarget, option) : closeSubmenu()
                }
                sx={{ height: 48, gap: 1 }}
              >
                  {loading ? (
                    <CircularProgress size={20} sx={{ m: 0.25, flexShrink: 0 }} />
                  ) : (
                    renderWorkspaceIcon(option)
                  )}

                  <Typography
                    component="span"
                    variant="body2"
                    sx={{
                      flexGrow: 1,
                      minWidth: 0,
                      lineHeight: 1.3,
                      whiteSpace: 'normal',
                      fontWeight: 'fontWeightMedium',
                    }}
                  >
                    {option.name}
                  </Typography>

                  {hasSubmenu ? (
                    <Iconify
                      width={16}
                      icon="eva:arrow-ios-forward-fill"
                      sx={{ color: 'text.disabled', ml: 0.5 }}
                    />
                  ) : (
                    renderInfoButton(option.id, option.name)
                  )}
                </MenuItem>
              );
            })}
          </MenuList>
        </Scrollbar>

        {renderSubmenu()}
      </CustomPopover>
  );

  return (
    <>
      {renderButton()}
      {renderMenuList()}

      <RolePermissionsDialog
        open={Boolean(permisosRol)}
        rolCodigo={permisosRol?.rolCodigo}
        rolNombre={permisosRol?.rolNombre}
        onClose={closePermisos}
      />
    </>
  );
}
