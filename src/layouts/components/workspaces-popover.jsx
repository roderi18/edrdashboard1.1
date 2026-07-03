'use client';

import { usePopover } from 'minimal-shared/hooks';
import { useMemo, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Avatar from '@mui/material/Avatar';
import Popover from '@mui/material/Popover';
import MenuList from '@mui/material/MenuList';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import ButtonBase from '@mui/material/ButtonBase';
import CircularProgress from '@mui/material/CircularProgress';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { Scrollbar } from 'src/components/scrollbar';
import { CustomPopover } from 'src/components/custom-popover';

import { useAuthContext } from 'src/auth/hooks';
import { ROLES } from 'src/auth/permissions/roles';
import { guardarAsignacionRolUsuario } from 'src/auth/permissions';

// ----------------------------------------------------------------------

// Cargos organizacionales que se muestran dentro del submenu de cada rol
// administrador. Permanecen deshabilitados hasta que se definan los permisos
// que debe tener cada uno.
const SUBROLES_POR_ROL = {
  // "Coordinador de Destacamento" es ahora el rol en si (primer item), por eso
  // no se repite aqui como cargo.
  [ROLES.USUARIO_DESTACAMENTO]: [
    'Pastor',
    'Coordinador Asistente de Destacamento',
    'Consejo Destacamento',
    'Capellán',
    'Líder de Grupo',
    'Líder Asistente de Grupo',
  ],
  // "Coordinador Seccional" es ahora el rol en si (primer item).
  [ROLES.USUARIO_SECCION]: [
    'Capellán Seccional',
    'Sub-Coordinador Seccional',
    'Coordinador de Adiestramiento',
    'Coordinador de Promoción',
    'Coordinador de Producción',
    'Coordinador de Programa',
    'Secretario Regional',
    'Zonas',
    'Grupos Locales',
  ],
  // "Director Regional" es ahora el rol en si (primer item).
  [ROLES.USUARIO_REGION]: [
    'Capellán Regional',
    'Sub-Director Regional',
    'Coordinador de Adiestramiento',
    'Coordinador de Promoción',
    'Coordinador de Producción',
    'Coordinador de Programa',
    'Secretario Regional',
  ],
  [ROLES.CONSEJO_NACIONAL]: [
    'Ministerios Infantiles',
    'Director Nacional',
    'Capellán Nacional',
    'Coordinador Nacional de Adiestramiento',
    'Sub-Director Nacional',
    'Coordinador Nacional de Promoción',
    'Coordinador Nacional de Producción',
    'Coordinador Nacional de Programa',
    'Comités Especiales',
    'Oficiales de Adiestramientos Especiales',
  ],
};

// Roles que solo funcionan como agrupador: su submenu muestra unicamente los
// cargos (deshabilitados) y NO incluye el item que cambia de sesion.
const ROLES_SOLO_AGRUPADOR = new Set([ROLES.CONSEJO_NACIONAL]);

export function WorkspacesPopover({ data = [], sx, ...other }) {
  const mediaQuery = 'sm';

  const { open, anchorEl, onClose, onOpen } = usePopover();

  const { user } = useAuthContext();
  const [loadingRoleId, setLoadingRoleId] = useState('');
  const [submenuAnchor, setSubmenuAnchor] = useState(null);
  const [submenuOption, setSubmenuOption] = useState(null);

  const openSubmenu = useCallback((anchor, option) => {
    setSubmenuAnchor(anchor);
    setSubmenuOption(option);
  }, []);

  const closeSubmenu = useCallback(() => {
    setSubmenuAnchor(null);
    setSubmenuOption(null);
  }, []);

  const currentRoleId = user?.rolId || user?.roleId || user?.rolCodigo || user?.roleCodigo || '';
  const selectedWorkspace = useMemo(
    () => data.find((option) => option.id === currentRoleId) || data[0],
    [currentRoleId, data]
  );
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
        await guardarAsignacionRolUsuario({
          uidUsuario: user.uid,
          correo: user.email || user.correo || '',
          nombre: user.displayName || [user.nombres, user.apellidos].filter(Boolean).join(' '),
          rolId: newValue.id,
          rolNombre: newValue.name,
          alcance: newValue.plan ? { tipo: newValue.plan, modo: newValue.plan } : {},
          usuario: user,
        });

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

  const renderButton = () => (
    <ButtonBase
      disableRipple
      onClick={onOpen}
      sx={[
        {
          py: 0.5,
          gap: { xs: 0.5, [mediaQuery]: 1 },
          '&::before': buttonBg,
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

      <Iconify width={16} icon="carbon:chevron-sort" sx={{ color: 'text.disabled' }} />
    </ButtonBase>
  );

  const handleCloseAll = useCallback(() => {
    closeSubmenu();
    onClose();
  }, [closeSubmenu, onClose]);

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
          {!soloAgrupador && (
            <MenuItem
              selected={submenuOption?.id === workspace?.id}
              disabled={Boolean(loadingRoleId)}
              onClick={() => handleChangeWorkspace(submenuOption)}
              sx={{ height: 48 }}
            >
              {submenuOption?.id === loadingRoleId ? (
                <CircularProgress size={20} sx={{ m: 0.25, flexShrink: 0 }} />
              ) : (
                renderWorkspaceIcon(submenuOption)
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
                {submenuOption?.name}
              </Typography>
            </MenuItem>
          )}

          {subRoles.map((nombre) => (
            <MenuItem key={nombre} disabled sx={{ height: 48 }}>
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
                {nombre}
              </Typography>
            </MenuItem>
          ))}
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
            const selected = option.id === workspace?.id;
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
                sx={{ height: 48 }}
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

                  {hasSubmenu && (
                    <Iconify
                      width={16}
                      icon="eva:arrow-ios-forward-fill"
                      sx={{ color: 'text.disabled', ml: 0.5 }}
                    />
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
    </>
  );
}
