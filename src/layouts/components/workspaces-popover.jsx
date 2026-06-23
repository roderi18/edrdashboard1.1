'use client';

import { usePopover } from 'minimal-shared/hooks';
import { useMemo, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Avatar from '@mui/material/Avatar';
import MenuList from '@mui/material/MenuList';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import ButtonBase from '@mui/material/ButtonBase';
import CircularProgress from '@mui/material/CircularProgress';

import { Label } from 'src/components/label';
import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { Scrollbar } from 'src/components/scrollbar';
import { CustomPopover } from 'src/components/custom-popover';

import { useAuthContext } from 'src/auth/hooks';
import { guardarAsignacionRolUsuario } from 'src/auth/permissions';

// ----------------------------------------------------------------------

export function WorkspacesPopover({ data = [], sx, ...other }) {
  const mediaQuery = 'sm';

  const { open, anchorEl, onClose, onOpen } = usePopover();

  const { user } = useAuthContext();
  const [loadingRoleId, setLoadingRoleId] = useState('');

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
    [onClose, user]
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

      <Label
        color={workspace?.plan === 'Free' ? 'default' : 'info'}
        sx={{
          height: 22,
          cursor: 'inherit',
          display: { xs: 'none', [mediaQuery]: 'inline-flex' },
        }}
      >
        {workspace?.badge || workspace?.plan || 'admin'}
      </Label>

      <Iconify width={16} icon="carbon:chevron-sort" sx={{ color: 'text.disabled' }} />
    </ButtonBase>
  );

  const renderMenuList = () => (
    <CustomPopover
      open={open}
      anchorEl={anchorEl}
      onClose={onClose}
      slotProps={{
        arrow: { placement: 'top-left' },
        paper: { sx: { mt: 0.5, ml: -1.55, width: 360, maxWidth: 'calc(100vw - 32px)' } },
      }}
    >
      <Scrollbar sx={{ maxHeight: 320 }}>
        <MenuList>
          {data.map((option) => {
            const selected = option.id === workspace?.id;
            const loading = option.id === loadingRoleId;

            return (
              <MenuItem
                key={option.id}
                selected={selected}
                disabled={Boolean(loadingRoleId)}
                onClick={() => handleChangeWorkspace(option)}
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

                <Label color="info">{option.badge || option.plan}</Label>
              </MenuItem>
            );
          })}
        </MenuList>
      </Scrollbar>
    </CustomPopover>
  );

  return (
    <>
      {renderButton()}
      {renderMenuList()}
    </>
  );
}
