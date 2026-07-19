'use client';

import { useMemo } from 'react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { Iconify } from 'src/components/iconify';
import { Scrollbar } from 'src/components/scrollbar';

import {
  ROLES_POR_CODIGO,
  PERMISOS_POR_ROL,
  PERMISOS_CATALOGO,
  PERMISOS_POR_CODIGO,
} from 'src/auth/permissions';

// ----------------------------------------------------------------------

const MODULE_LABELS = {
  administracion: 'Administración',
  ascenso: 'Sistema de Ascenso',
  asistencia: 'Asistencia',
  correos: 'Correos',
  destacamentos: 'Destacamentos',
  documentos: 'Documentos',
  miembros: 'Miembros',
  padres: 'Padres / tutores',
  regiones: 'Regiones',
  reportes: 'Reportes',
  salud: 'Dispensa Médica',
  secciones: 'Secciones',
  tienda: 'Tienda',
  otros: 'Otros',
};

const getPermissionLabel = (permissionCode) =>
  PERMISOS_POR_CODIGO[permissionCode]?.nombre || String(permissionCode).replaceAll('.', ' ');

const getPermissionModule = (permissionCode) =>
  PERMISOS_POR_CODIGO[permissionCode]?.modulo || 'otros';

const groupByModule = (permissions = []) =>
  permissions.reduce((groups, code) => {
    const moduleKey = getPermissionModule(code);
    groups[moduleKey] = groups[moduleKey] || [];
    groups[moduleKey].push(code);
    return groups;
  }, {});

function PermissionRow({ permissionCode, granted }) {
  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <Iconify
        width={18}
        icon={granted ? 'solar:check-circle-bold' : 'solar:close-circle-bold'}
        sx={{ flexShrink: 0, color: granted ? 'success.main' : 'text.disabled' }}
      />
      <Typography
        variant="body2"
        sx={{ color: granted ? 'text.primary' : 'text.disabled' }}
      >
        {getPermissionLabel(permissionCode)}
      </Typography>
    </Stack>
  );
}

export function RolePermissionsDialog({ open, rolCodigo, rolNombre, onClose }) {
  const rol = rolCodigo ? ROLES_POR_CODIGO[rolCodigo] : null;

  const { granted, missing } = useMemo(() => {
    const permisosRol = new Set(PERMISOS_POR_ROL[rolCodigo] || []);
    const grantedCodes = [];
    const missingCodes = [];

    PERMISOS_CATALOGO.forEach((permiso) => {
      if (permisosRol.has(permiso.codigo)) {
        grantedCodes.push(permiso.codigo);
      } else {
        missingCodes.push(permiso.codigo);
      }
    });

    return { granted: grantedCodes, missing: missingCodes };
  }, [rolCodigo]);

  const grantedByModule = groupByModule(granted);
  const missingByModule = groupByModule(missing);

  const renderColumn = (title, color, groups, count, isGranted) => (
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 1.5 }}>
        <Iconify
          width={20}
          icon={isGranted ? 'solar:check-circle-bold' : 'solar:close-circle-bold'}
          sx={{ color }}
        />
        <Typography variant="subtitle2">
          {title} ({count})
        </Typography>
      </Stack>

      {count ? (
        <Stack spacing={2}>
          {Object.entries(groups).map(([moduleKey, codes]) => (
            <Box key={moduleKey}>
              <Typography
                variant="caption"
                sx={{ mb: 0.75, display: 'block', color: 'text.secondary' }}
              >
                {MODULE_LABELS[moduleKey] || moduleKey}
              </Typography>
              <Stack spacing={0.75}>
                {codes.map((code) => (
                  <PermissionRow key={code} permissionCode={code} granted={isGranted} />
                ))}
              </Stack>
            </Box>
          ))}
        </Stack>
      ) : (
        <Typography variant="body2" sx={{ color: 'text.disabled' }}>
          {isGranted ? 'Sin permisos asignados.' : 'Tiene todos los permisos.'}
        </Typography>
      )}
    </Box>
  );

  return (
    <Dialog fullWidth maxWidth="sm" open={open} onClose={onClose}>
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            Permisos
            <Box component="span" sx={{ ml: 1, typography: 'body2', color: 'text.secondary' }}>
              {rolNombre || rol?.nombre || ''}
            </Box>
          </Box>

          <Button
            size="small"
            variant="outlined"
            color="inherit"
            component={RouterLink}
            href={paths.dashboard.admin.root}
            onClick={onClose}
            startIcon={<Iconify width={18} icon="solar:pen-bold" />}
            sx={{ flexShrink: 0 }}
          >
            Cambiar permisos
          </Button>
        </Stack>
      </DialogTitle>

      <DialogContent dividers sx={{ p: 0 }}>
        <Scrollbar sx={{ maxHeight: '60vh' }}>
          <Box sx={{ p: 3 }}>
            {rol?.descripcion ? (
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2.5 }}>
                {rol.descripcion}
              </Typography>
            ) : null}

            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={3}
              divider={<Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', sm: 'block' } }} />}
            >
              {renderColumn('Tiene', 'success.main', grantedByModule, granted.length, true)}
              {renderColumn('No tiene', 'text.disabled', missingByModule, missing.length, false)}
            </Stack>
          </Box>
        </Scrollbar>
      </DialogContent>

      <DialogActions>
        <Button variant="contained" onClick={onClose}>
          Cerrar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
