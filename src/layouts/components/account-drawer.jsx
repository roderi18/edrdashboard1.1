'use client';

import { useState, useEffect } from 'react';
import { varAlpha } from 'minimal-shared/utils';
import { useBoolean } from 'minimal-shared/hooks';

import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Avatar from '@mui/material/Avatar';
import Drawer from '@mui/material/Drawer';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import MenuList from '@mui/material/MenuList';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';

import { paths } from 'src/routes/paths';
import { usePathname } from 'src/routes/hooks';
import { RouterLink } from 'src/routes/components';

import { etiquetaDeCargo, useCargosDelUsuario } from 'src/hooks/use-cargos-del-usuario';

import { rolesQueEjerce } from 'src/utils/org-level-access';
import { isMemberSessionUser, getMemberCodeForDisplay } from 'src/utils/member-access';
import { getAdminRoleLabel, ROLES_DE_ADMINISTRACION } from 'src/utils/admin-role-label';
import {
  cambiarVerComoUsuario,
  ejerceAdministradorGlobal,
} from 'src/utils/administrador-global-reina.mjs';

import { _mock } from 'src/_mock';
import { getDests, getDestsApi } from 'src/services/dest-service';

import { Label } from 'src/components/label';
import { Iconify } from 'src/components/iconify';
import { Scrollbar } from 'src/components/scrollbar';
import { AnimateBorder } from 'src/components/animate';

import { useAuthContext } from 'src/auth/hooks';
import { ROLES_POR_CODIGO } from 'src/auth/permissions/roles';

import { UpgradeBlock } from './nav-upgrade';
import { AccountButton } from './account-button';
import { SignOutButton } from './sign-out-button';

// ----------------------------------------------------------------------

export function AccountDrawer({ data = [], sx, onProbarComoUsuario, ...other }) {
  const pathname = usePathname();

  const { user } = useAuthContext();
  const memberCode = getMemberCodeForDisplay(user);
  // Destacamentos, para traducir el id del alcance a su NÚMERO en la etiqueta del
  // rol. Se parte de la caché local (ya poblada por las listas) y solo se pide a
  // la API si está vacía, p. ej. al entrar directo sin pasar por la lista.
  const [dests, setDests] = useState(() => getDests());

  useEffect(() => {
    if (dests.length) return undefined;

    let cancelled = false;

    getDestsApi({ includePhotos: false })
      .then((rows) => {
        if (!cancelled) setDests(Array.isArray(rows) ? rows : []);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [dests.length]);

  const adminRoleLabel = !isMemberSessionUser(user) ? getAdminRoleLabel(user, { dests }) : '';
  const accountName = user?.displayName || user?.nombres || user?.name || user?.email || '';
  const cargos = useCargosDelUsuario(user);
  // LOS CARGOS DE ADMINISTRACION, debajo de los de la organizacion. Se asignan
  // aparte —desde Administradores, no en una casilla de la directiva—, asi que
  // no salen en `cargos`: quien era Coordinador Asistente y Administrador de
  // Gestion de Tienda solo veia lo primero, y no sabia que tenia lo segundo.
  const cargosDeAdministracion = rolesQueEjerce(user)
    .filter((codigo) => ROLES_DE_ADMINISTRACION.includes(codigo))
    .map((codigo) => ROLES_POR_CODIGO[codigo]?.nombre)
    .filter(Boolean);
  const accountPhotoURL = user?.photoURL || '';
  // La cuenta administrativa antigua llega con `role: 'admin'` y sin el código.
  const puedeVerComoUsuario =
    ejerceAdministradorGlobal(user) ||
    String(user?.role ?? user?.rol ?? '')
      .trim()
      .toLowerCase() === 'admin';

  const { value: open, onFalse: onClose, onTrue: onOpen } = useBoolean();

  const renderAvatar = () => (
    <AnimateBorder
      sx={{ mb: 2, p: '6px', width: 96, height: 96, borderRadius: '50%' }}
      slotProps={{
        primaryBorder: { size: 120, sx: { color: 'primary.main' } },
      }}
    >
      <Avatar src={accountPhotoURL} alt={user?.displayName} sx={{ width: 1, height: 1 }}>
        {(user?.displayName || user?.email || '?').charAt(0).toUpperCase()}
      </Avatar>
    </AnimateBorder>
  );

  const renderList = () => (
    <MenuList
      disablePadding
      sx={[
        (theme) => ({
          py: 3,
          px: 2.5,
          borderTop: `dashed 1px ${theme.vars.palette.divider}`,
          borderBottom: `dashed 1px ${theme.vars.palette.divider}`,
          '& li': { p: 0 },
        }),
      ]}
    >
      {data.map((option) => {
        const rootLabel = pathname.includes('/dashboard') ? 'Home' : 'Panel';
        const rootHref = pathname.includes('/dashboard') ? '/' : paths.dashboard.root;
        const disabled = Boolean(option.disabled);
        const href = option.label === 'Home' ? rootHref : option.href;

        return (
          <MenuItem key={option.label} disabled={disabled}>
            <Link
              component={disabled ? 'span' : RouterLink}
              href={disabled ? undefined : href}
              color="inherit"
              underline="none"
              aria-disabled={disabled}
              onClick={disabled ? undefined : onClose}
              sx={{
                p: 1,
                width: 1,
                display: 'flex',
                typography: 'body2',
                alignItems: 'center',
                color: 'text.secondary',
                cursor: disabled ? 'not-allowed' : 'pointer',
                '& svg': { width: 24, height: 24 },
                '&:hover': { color: disabled ? 'text.secondary' : 'text.primary' },
              }}
            >
              {option.icon}

              <Box component="span" sx={{ ml: 2 }}>
                {option.label === 'Home' ? rootLabel : option.label}
              </Box>

              {option.info && (
                <Label color="error" sx={{ ml: 1 }}>
                  {option.info}
                </Label>
              )}
            </Link>
          </MenuItem>
        );
      })}
    </MenuList>
  );

  return (
    <>
      <AccountButton
        onClick={onOpen}
        photoURL={accountPhotoURL}
        displayName={accountName}
        sx={sx}
        {...other}
      />

      <Drawer
        open={open}
        onClose={onClose}
        anchor="right"
        slotProps={{
          backdrop: { invisible: true },
          paper: { sx: { width: 320 } },
        }}
      >
        <IconButton
          onClick={onClose}
          sx={{
            top: 12,
            left: 12,
            zIndex: 9,
            position: 'absolute',
          }}
        >
          <Iconify icon="mingcute:close-line" />
        </IconButton>

        <Scrollbar>
          <Box
            sx={{
              pt: 8,
              display: 'flex',
              alignItems: 'center',
              flexDirection: 'column',
            }}
          >
            {renderAvatar()}

            <Typography variant="subtitle1" noWrap sx={{ mt: 2 }}>
              {accountName}
            </Typography>

            {!isMemberSessionUser(user) && !cargos.length && !cargosDeAdministracion.length && (
              <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }} noWrap>
                {adminRoleLabel}
              </Typography>
            )}

            {/* Todos sus cargos: una persona puede ser Coordinador Asistente en
                su destacamento y Sub Coordinador en su seccion, y ejerce los
                dos. */}
            {cargos.map((cargo) => (
              <Typography
                key={`${cargo.idPosicion}-${cargo.idEntidad}`}
                variant="body2"
                sx={{ color: 'text.secondary', mt: 0.5, textAlign: 'center', px: 2 }}
              >
                {etiquetaDeCargo(cargo)}
              </Typography>
            ))}

            {cargosDeAdministracion.map((nombre) => (
              <Typography
                key={nombre}
                variant="body2"
                sx={{ color: 'text.secondary', mt: 0.5, textAlign: 'center', px: 2 }}
              >
                {nombre}
              </Typography>
            ))}

            {/* El correo no se enseña aqui: el panel lo abre cualquiera que pase
                por delante de la pantalla. Basta con el codigo de miembro. */}
            {memberCode && (
              <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }} noWrap>
                {memberCode}
              </Typography>
            )}
          </Box>

          <Box
            sx={{
              p: 3,
              gap: 1,
              flexWrap: 'wrap',
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            {Array.from({ length: 3 }, (_, index) => (
              <Tooltip
                key={_mock.fullName(index + 1)}
                title={`Switch to: ${_mock.fullName(index + 1)}`}
              >
                <Avatar
                  alt={_mock.fullName(index + 1)}
                  src={_mock.image.avatar(index + 1)}
                  onClick={() => {}}
                />
              </Tooltip>
            ))}

            <Tooltip title="Add account">
              <IconButton
                sx={[
                  (theme) => ({
                    bgcolor: varAlpha(theme.vars.palette.grey['500Channel'], 0.08),
                    border: `dashed 1px ${varAlpha(theme.vars.palette.grey['500Channel'], 0.32)}`,
                  }),
                ]}
              >
                <Iconify icon="mingcute:add-line" />
              </IconButton>
            </Tooltip>
          </Box>

          {renderList()}

          <Box sx={{ px: 2.5, py: 3 }}>
            <UpgradeBlock />
          </Box>
        </Scrollbar>

        <Box sx={{ p: 2.5 }}>
          {onProbarComoUsuario && (
            <Button
              fullWidth
              variant="outlined"
              startIcon={<Iconify icon="solar:user-id-bold-duotone" />}
              onClick={() => {
                onClose();
                onProbarComoUsuario();
              }}
              sx={{ mb: 1 }}
            >
              Probar como usuario
            </Button>
          )}
          {/* Solo quien tiene Administrador Global (o lo tiene apagado con esta
              vista): ve pestañas y pantallas como alguien sin ese rol. Vive en
              la pestaña; volver recarga con su mando de siempre. */}
          {(user?.verComoUsuario || puedeVerComoUsuario) && (
            <Button
              fullWidth
              variant={user?.verComoUsuario ? 'contained' : 'outlined'}
              color={user?.verComoUsuario ? 'warning' : 'inherit'}
              startIcon={
                <Iconify icon={user?.verComoUsuario ? 'solar:eye-closed-bold' : 'solar:eye-bold'} />
              }
              onClick={() => {
                cambiarVerComoUsuario(!user?.verComoUsuario);
                window.location.reload();
              }}
              sx={{ mb: 1 }}
            >
              {user?.verComoUsuario ? 'Volver a Administrador Global' : 'Ver como usuario'}
            </Button>
          )}
          <SignOutButton onClose={onClose} />
        </Box>
      </Drawer>
    </>
  );
}
