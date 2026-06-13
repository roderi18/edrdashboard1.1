'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';

import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import { getDestsApi } from 'src/services/dest-service';
import { getRegionals } from 'src/services/regional-service';
import { getSectionals } from 'src/services/sectional-service';

import { toast } from 'src/components/snackbar';

import { useAuthContext } from 'src/auth/hooks';
import {
  ALCANCES,
  ROLES_CATALOGO,
  ROLES_POR_CODIGO,
  crearDefinicionRol,
  PERMISOS_POR_CODIGO,
  obtenerRolesAutorizacion,
  obtenerAsignacionRolUsuario,
  guardarAsignacionRolUsuario,
} from 'src/auth/permissions';

// ----------------------------------------------------------------------

const LOCAL_ROLES = ROLES_CATALOGO.map(crearDefinicionRol);

const ALCANCE_OPTIONS = [
  { value: ALCANCES.DESTACAMENTO, label: 'Destacamento' },
  { value: ALCANCES.SECCION, label: 'Seccion' },
  { value: ALCANCES.REGION, label: 'Region' },
  { value: ALCANCES.NACIONAL, label: 'Nacional' },
  { value: ALCANCES.GLOBAL, label: 'Global' },
];

const getUserDocId = (admin = {}) =>
  String(
    admin.uid ||
      admin.idUsuario ||
      admin.adminId ||
      admin.idMiembros ||
      admin.memberId ||
      admin.codigoMiembro ||
      admin.memberCode ||
      admin.id ||
      ''
  ).trim();

const getRoleName = (role) => role?.nombre || ROLES_POR_CODIGO[role?.codigo]?.nombre || role?.codigo || '';

const getPermissionLabel = (permission) => PERMISOS_POR_CODIGO[permission]?.nombre || permission;

const getRegionalId = (regional) => String(regional?.id || regional?.regionId || regional?.idRegion || '');

const getRegionalLabel = (regional) => {
  const id = getRegionalId(regional);
  const name = regional?.regionalName || regional?.name || regional?.nombre || 'Region';

  return id ? `${name} (${id})` : name;
};

const getSectionalId = (sectional) =>
  String(sectional?.id || sectional?.idSeccion || sectional?.sectionalId || '');

const getSectionalLabel = (sectional) => {
  const id = getSectionalId(sectional);
  const name = sectional?.sectionalName || sectional?.name || sectional?.nombre || 'Seccion';

  return id ? `${name} (${id})` : name;
};

const getDestId = (dest) => String(dest?.id || dest?.idDestacamento || dest?.destId || '');

const getDestLabel = (dest) => {
  const id = getDestId(dest);
  const number = dest?.destNumber || dest?.numero || '';
  const name = dest?.name || dest?.nombre || dest?.destName || 'Destacamento';
  const title = [name, number].filter(Boolean).join(' ');

  return id ? `${title} (${id})` : title;
};

const buildInitialScope = (role) => ({
  tipo: role?.alcancePredeterminado || ALCANCES.DESTACAMENTO,
  regionId: '',
  seccionId: '',
  destacamentoId: '',
  nacional: role?.alcancePredeterminado === ALCANCES.NACIONAL,
});

export function AdminRoleAssignmentDialog({ open, admin, onClose, onSaved }) {
  const { user } = useAuthContext();
  const [roles, setRoles] = useState(LOCAL_ROLES);
  const [rolId, setRolId] = useState('');
  const [scope, setScope] = useState(buildInitialScope());
  const [scopeOptions, setScopeOptions] = useState({
    regionals: [],
    sectionals: [],
    dests: [],
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const userDocId = getUserDocId(admin);
  const selectedRole = useMemo(
    () => roles.find((role) => role.codigo === rolId) || null,
    [roles, rolId]
  );

  const assignableRoles = useMemo(
    () => roles.filter((role) => role.codigo !== 'administrador_global'),
    [roles]
  );

  const loadData = useCallback(async () => {
    if (!open) return;

    setLoading(true);

    try {
      const [rolesResult, assignment] = await Promise.all([
        obtenerRolesAutorizacion().catch(() => []),
        userDocId ? obtenerAsignacionRolUsuario(userDocId).catch(() => null) : null,
      ]);
      const nextRoles = rolesResult.length ? rolesResult : LOCAL_ROLES;
      const fallbackRole =
        assignment?.rolId ||
        admin?.rolId ||
        admin?.roleId ||
        admin?.rol ||
        admin?.role ||
        'usuario_comun';
      const role =
        nextRoles.find((item) => item.codigo === fallbackRole) ||
        nextRoles.find((item) => item.codigo === 'usuario_comun') ||
        nextRoles[0];

      setRoles(nextRoles);
      setRolId(role?.codigo || '');
      setScope({
        ...buildInitialScope(role),
        ...(assignment?.alcance || admin?.alcance || {}),
      });
    } catch (error) {
      console.error(error);
      toast.error(error.message || 'No se pudo cargar la asignacion de rol.');
    } finally {
      setLoading(false);
    }
  }, [admin, open, userDocId]);

  const loadScopeOptions = useCallback(async () => {
    if (!open) return;

    const [regionals, sectionals, dests] = await Promise.all([
      getRegionals({ includePhotos: false }).catch(() => []),
      getSectionals({ includePhotos: false }).catch(() => []),
      getDestsApi({ includePhotos: false }).catch(() => []),
    ]);

    setScopeOptions({ regionals, sectionals, dests });
  }, [open]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    loadScopeOptions();
  }, [loadScopeOptions]);

  useEffect(() => {
    if (!selectedRole) return;

    setScope((current) => ({
      ...current,
      tipo: current.tipo || selectedRole.alcancePredeterminado || ALCANCES.DESTACAMENTO,
      nacional:
        current.tipo === ALCANCES.NACIONAL || selectedRole.alcancePredeterminado === ALCANCES.NACIONAL,
    }));
  }, [selectedRole]);

  const handleChangeRole = (event) => {
    const nextRoleId = event.target.value;
    const nextRole = roles.find((role) => role.codigo === nextRoleId);

    setRolId(nextRoleId);
    setScope(buildInitialScope(nextRole));
  };

  const handleChangeScopeType = (event) => {
    const nextType = event.target.value;

    setScope((current) => ({
      ...current,
      tipo: nextType,
      nacional: nextType === ALCANCES.NACIONAL || nextType === ALCANCES.GLOBAL,
    }));
  };

  const handleSave = async () => {
    if (!userDocId) {
      toast.error('No encontramos un identificador para este usuario.');
      return;
    }

    if (!selectedRole) {
      toast.error('Selecciona un rol.');
      return;
    }

    setSaving(true);

    try {
      const payload = await guardarAsignacionRolUsuario({
        uidUsuario: userDocId,
        correo: admin?.email || admin?.correo || '',
        nombre: admin?.name || admin?.displayName || '',
        rolId: selectedRole.codigo,
        rolNombre: getRoleName(selectedRole),
        alcance: scope,
        restricciones: {},
        usuario: user,
      });

      toast.success('Rol asignado correctamente.');
      onSaved?.({
        ...payload,
        rolId: selectedRole.codigo,
        rolNombre: getRoleName(selectedRole),
        permisos: selectedRole.permisos || [],
      });
      onClose?.();
    } catch (error) {
      console.error(error);
      toast.error(error.message || 'No se pudo guardar el rol.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog fullWidth maxWidth="md" open={open} onClose={saving ? undefined : onClose}>
      <DialogTitle>Asignar rol</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={3} sx={{ pt: 1 }}>
          <Stack spacing={0.5}>
            <Typography variant="subtitle2">{admin?.name || 'Usuario'}</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {admin?.email || admin?.correo || userDocId || '-'}
            </Typography>
          </Stack>

          <TextField
            select
            fullWidth
            label="Rol base"
            value={rolId}
            disabled={loading || saving}
            onChange={handleChangeRole}
          >
            {assignableRoles.map((role) => (
              <MenuItem key={role.codigo} value={role.codigo}>
                {getRoleName(role)}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            fullWidth
            label="Alcance"
            value={scope.tipo || ALCANCES.DESTACAMENTO}
            disabled={loading || saving}
            onChange={handleChangeScopeType}
          >
            {ALCANCE_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>

          {scope.tipo === ALCANCES.REGION && (
            <TextField
              select
              fullWidth
              label="Region"
              value={scope.regionId || ''}
              disabled={saving}
              onChange={(event) => setScope((current) => ({ ...current, regionId: event.target.value }))}
            >
              {scopeOptions.regionals.map((regional) => (
                <MenuItem key={getRegionalId(regional)} value={getRegionalId(regional)}>
                  {getRegionalLabel(regional)}
                </MenuItem>
              ))}
            </TextField>
          )}

          {scope.tipo === ALCANCES.SECCION && (
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                select
                fullWidth
                label="Region"
                value={scope.regionId || ''}
                disabled={saving}
                onChange={(event) => setScope((current) => ({ ...current, regionId: event.target.value }))}
              >
                {scopeOptions.regionals.map((regional) => (
                  <MenuItem key={getRegionalId(regional)} value={getRegionalId(regional)}>
                    {getRegionalLabel(regional)}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                fullWidth
                label="Seccion"
                value={scope.seccionId || ''}
                disabled={saving}
                onChange={(event) => {
                  const selectedSection = scopeOptions.sectionals.find(
                    (sectional) => getSectionalId(sectional) === event.target.value
                  );

                  setScope((current) => ({
                    ...current,
                    seccionId: event.target.value,
                    regionId: selectedSection?.regionalId || current.regionId,
                  }));
                }}
              >
                {scopeOptions.sectionals.map((sectional) => (
                  <MenuItem key={getSectionalId(sectional)} value={getSectionalId(sectional)}>
                    {getSectionalLabel(sectional)}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
          )}

          {scope.tipo === ALCANCES.DESTACAMENTO && (
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                select
                fullWidth
                label="Seccion"
                value={scope.seccionId || ''}
                disabled={saving}
                onChange={(event) => setScope((current) => ({ ...current, seccionId: event.target.value }))}
              >
                {scopeOptions.sectionals.map((sectional) => (
                  <MenuItem key={getSectionalId(sectional)} value={getSectionalId(sectional)}>
                    {getSectionalLabel(sectional)}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                fullWidth
                label="Destacamento"
                value={scope.destacamentoId || ''}
                disabled={saving}
                onChange={(event) => {
                  const selectedDest = scopeOptions.dests.find(
                    (dest) => getDestId(dest) === event.target.value
                  );

                  setScope((current) => ({
                    ...current,
                    destacamentoId: event.target.value,
                    seccionId: selectedDest?.sectionalId || selectedDest?.idSeccion || current.seccionId,
                  }));
                }}
              >
                {scopeOptions.dests.map((dest) => (
                  <MenuItem key={getDestId(dest)} value={getDestId(dest)}>
                    {getDestLabel(dest)}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
          )}

          <Stack spacing={1}>
            <Typography variant="subtitle2">Permisos heredados</Typography>
            <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
              {(selectedRole?.permisos || []).map((permission) => (
                <Chip key={permission} size="small" variant="soft" label={getPermissionLabel(permission)} />
              ))}
            </Stack>
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button color="inherit" disabled={saving} onClick={onClose}>
          Cancelar
        </Button>
        <Button variant="contained" loading={saving} onClick={handleSave}>
          Guardar rol
        </Button>
      </DialogActions>
    </Dialog>
  );
}
