'use client';

import { useMemo, useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Switch from '@mui/material/Switch';
import Dialog from '@mui/material/Dialog';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import TableContainer from '@mui/material/TableContainer';

import {
  normalizarPermisosAdmin,
  ADMIN_PERMISSION_ACTIONS,
  ADMIN_PERMISSION_MODULES,
  guardarPermisosAdministrador,
} from 'src/services/admin-permissions-service';

import { toast } from 'src/components/snackbar';
import { Scrollbar } from 'src/components/scrollbar';
import { TableHeadCustom } from 'src/components/table';

import { useAuthContext } from 'src/auth/hooks';

// ----------------------------------------------------------------------

const TABLE_HEAD = [
  { id: 'modulo', label: 'Módulo', width: 180 },
  ...ADMIN_PERMISSION_ACTIONS.map((action) => ({
    id: action.key,
    label: action.label,
    align: 'center',
    width: 112,
  })),
];

export function AdminPermissionsDialog({ open, admin, onClose, onSaved }) {
  const { user } = useAuthContext();
  const [saving, setSaving] = useState(false);
  const [permissions, setPermissions] = useState(() => normalizarPermisosAdmin());

  useEffect(() => {
    if (open) {
      setPermissions(normalizarPermisosAdmin(admin?.permisos || admin?.permissions));
    }
  }, [admin, open]);

  const selectedCount = useMemo(
    () =>
      ADMIN_PERMISSION_MODULES.reduce(
        (total, module) =>
          total +
          ADMIN_PERMISSION_ACTIONS.filter((action) => permissions[module.key]?.[action.key]).length,
        0
      ),
    [permissions]
  );

  const handleToggle = (moduleKey, actionKey) => {
    setPermissions((current) => ({
      ...current,
      [moduleKey]: {
        ...current[moduleKey],
        [actionKey]: !current[moduleKey]?.[actionKey],
      },
    }));
  };

  const handleSave = async () => {
    setSaving(true);

    try {
      const savedPermissions = await guardarPermisosAdministrador({
        administrador: admin,
        permisos: permissions,
        usuario: user,
      });

      toast.success('Permisos actualizados correctamente.');
      onSaved?.(savedPermissions);
      onClose?.();
    } catch (error) {
      console.error(error);
      toast.error(error.message || 'No se pudieron guardar los permisos.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog fullWidth maxWidth="lg" open={open} onClose={saving ? undefined : onClose}>
      <DialogTitle>
        Ver permisos
        <Box component="span" sx={{ ml: 1, typography: 'body2', color: 'text.secondary' }}>
          {admin?.name || admin?.email || ''}
        </Box>
      </DialogTitle>

      <DialogContent sx={{ pb: 0 }}>
        <Box sx={{ mb: 2, typography: 'body2', color: 'text.secondary' }}>
          {selectedCount} permisos activos por módulo y acción.
        </Box>

        <TableContainer sx={{ maxHeight: 520 }}>
          <Scrollbar>
            <Table stickyHeader size="small" sx={{ minWidth: 980 }}>
              <TableHeadCustom headCells={TABLE_HEAD} />

              <TableBody>
                {ADMIN_PERMISSION_MODULES.map((module) => (
                  <TableRow key={module.key} hover>
                    <TableCell sx={{ typography: 'subtitle2' }}>{module.label}</TableCell>

                    {ADMIN_PERMISSION_ACTIONS.map((action) => (
                      <TableCell key={action.key} align="center">
                        <Switch
                          size="small"
                          checked={Boolean(permissions[module.key]?.[action.key])}
                          onChange={() => handleToggle(module.key, action.key)}
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Scrollbar>
        </TableContainer>
      </DialogContent>

      <DialogActions>
        <Button color="inherit" variant="outlined" disabled={saving} onClick={onClose}>
          Cancelar
        </Button>
        <Button variant="contained" loading={saving} onClick={handleSave}>
          Guardar permisos
        </Button>
      </DialogActions>
    </Dialog>
  );
}
