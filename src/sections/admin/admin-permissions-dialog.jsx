'use client';

import { useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import Skeleton from '@mui/material/Skeleton';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import { RouterLink } from 'src/routes/components';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';

import { useAuthContext } from 'src/auth/hooks';
import {
  PERMISOS,
  ROLES_POR_CODIGO,
  PERMISOS_POR_ROL,
  PERMISOS_CATALOGO,
  PERMISOS_POR_CODIGO,
  obtenerAccesoUsuario,
  guardarPermisosDirectosUsuario,
} from 'src/auth/permissions';

// ----------------------------------------------------------------------

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

const getPermissionLabel = (permissionCode) =>
  PERMISOS_POR_CODIGO[permissionCode]?.nombre || String(permissionCode).replaceAll('.', ' ');

const getPermissionModule = (permissionCode) => PERMISOS_POR_CODIGO[permissionCode]?.modulo || 'otros';

const MODULE_LABELS = {
  administracion: 'Administracion',
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

const groupPermissionsByModule = (permissions = []) =>
  permissions.reduce((groups, permissionCode) => {
    const moduleKey = getPermissionModule(permissionCode);

    groups[moduleKey] = groups[moduleKey] || [];
    groups[moduleKey].push(permissionCode);

    return groups;
  }, {});

const getRoleName = (access, admin) =>
  access?.rol?.nombre ||
  access?.rolNombre ||
  admin?.rolNombre ||
  ROLES_POR_CODIGO[access?.rolId || admin?.rolId || admin?.role]?.nombre ||
  access?.rolId ||
  admin?.rol ||
  admin?.role ||
  'Sin rol asignado';

const getScopeLabel = (scope = {}) => {
  const type = scope.tipo || scope.modo || 'destacamento';

  if (scope.nacional || type === 'nacional') return 'Nacional';
  if (type === 'global') return 'Global';
  if (type === 'region') return `Region ${scope.regionId || scope.idRegion || ''}`.trim();
  if (type === 'seccion') return `Seccion ${scope.seccionId || scope.idSeccion || ''}`.trim();

  return `Destacamento ${scope.destacamentoId || scope.idDestacamento || ''}`.trim();
};

const uniqueList = (items = []) => Array.from(new Set(items.filter(Boolean).map(String)));

const SENSITIVE_PERMISSIONS = {
  [PERMISOS.MIEMBROS_VER_MENORES]: {
    title: 'Permiso sensible',
    message:
      'Este permiso permite ver información de miembros menores de edad. Se requiere una aprobación de parte de la Oficina Nacional para revisión.',
  },
};

const formatChangeDate = (value) => {
  if (!value) return '';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat('es-DO', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
};

function PermissionChip({ permissionCode, origin, changeInfo, draggable = true }) {
  const isChanged = origin === 'directo' || origin === 'excluido';
  const isPending = origin === 'pendiente';
  const isSensitive = Boolean(SENSITIVE_PERMISSIONS[permissionCode]);
  const changeTooltip = changeInfo
    ? `${changeInfo.accion === 'agregado' ? 'Agregado' : changeInfo.accion === 'pendiente' ? 'Solicitud enviada' : 'Quitado'} por ${changeInfo.porNombre || changeInfo.por || 'sistema'}${changeInfo.fecha ? ` · ${formatChangeDate(changeInfo.fecha)}` : ''}`
    : '';

  return (
    <Chip
      draggable={draggable}
      onDragStart={(event) => {
        event.dataTransfer.setData('text/plain', permissionCode);
      }}
      size="small"
      variant="soft"
      color={origin === 'excluido' ? 'warning' : origin === 'directo' ? 'success' : 'default'}
      label={
        <Stack direction="row" spacing={0.75} alignItems="center">
          <Box component="span">{getPermissionLabel(permissionCode)}</Box>
          {isChanged ? (
            <Tooltip title={changeTooltip || 'Permiso modificado manualmente'}>
              <Box component="span" sx={{ lineHeight: 0, color: 'info.main' }}>
                <Iconify icon="solar:info-circle-bold" width={14} />
              </Box>
            </Tooltip>
          ) : null}
          {isPending ? (
            <Tooltip title={changeTooltip || 'Solicitud pendiente de aprobación'}>
              <Box component="span" sx={{ lineHeight: 0, color: 'warning.main' }}>
                <Iconify icon="solar:clock-circle-bold" width={14} />
              </Box>
            </Tooltip>
          ) : null}
          {isSensitive ? (
            <Tooltip title="Permiso sensible: involucra menores de edad. Requiere aprobación Oficina Nacional.">
              <Box component="span" sx={{ lineHeight: 0, color: 'warning.main' }}>
                <Iconify icon="solar:danger-triangle-bold" width={14} />
              </Box>
            </Tooltip>
          ) : null}
        </Stack>
      }
      sx={{
        cursor: draggable ? 'grab' : 'default',
        maxWidth: 1,
        '& .MuiChip-label': {
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        },
      }}
    />
  );
}

function PermissionDropZone({
  title,
  subtitle,
  permissions,
  getOrigin,
  getChangeInfo,
  onDropPermission,
  onMovePermission,
}) {
  const [isOver, setIsOver] = useState(false);
  const groupedPermissions = groupPermissionsByModule(permissions);

  return (
    <Box
      onDragOver={(event) => {
        event.preventDefault();
        setIsOver(true);
      }}
      onDragLeave={() => setIsOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setIsOver(false);
        onDropPermission(event.dataTransfer.getData('text/plain'));
      }}
      sx={{
        p: 2,
        height: 420,
        overflow: 'auto',
        borderRadius: 1,
        border: '1px dashed',
        borderColor: isOver ? 'primary.main' : 'divider',
        bgcolor: isOver ? 'action.hover' : 'background.neutral',
      }}
    >
      <Stack spacing={0.5} sx={{ mb: 1.5 }}>
        <Typography variant="subtitle1">{title}</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {subtitle}
        </Typography>
      </Stack>

      {permissions.length ? (
        <Stack spacing={2}>
          {Object.entries(groupedPermissions).map(([moduleKey, modulePermissions]) => (
            <Box key={moduleKey}>
              <Typography variant="caption" sx={{ mb: 0.75, display: 'block', color: 'text.secondary' }}>
                {MODULE_LABELS[moduleKey] || moduleKey}
              </Typography>

              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                {modulePermissions.map((permissionCode) => (
                  <PermissionChip
                    key={permissionCode}
                    permissionCode={permissionCode}
                    origin={getOrigin(permissionCode)}
                    changeInfo={getChangeInfo(permissionCode)}
                  />
                ))}
              </Stack>
            </Box>
          ))}
        </Stack>
      ) : (
        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
          <Typography variant="body2" sx={{ color: 'text.disabled' }}>
            Arrastra permisos aqui.
          </Typography>
        </Stack>
      )}
    </Box>
  );
}

export function AdminPermissionsDialog({ open, admin, onClose, onSaved }) {
  const { user } = useAuthContext();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [access, setAccess] = useState(null);
  const [error, setError] = useState('');
  const [directPermissions, setDirectPermissions] = useState([]);
  const [excludedPermissions, setExcludedPermissions] = useState([]);
  const [permissionsMetadata, setPermissionsMetadata] = useState({});
  const [sensitiveRequest, setSensitiveRequest] = useState(null);
  const [sensitiveJustification, setSensitiveJustification] = useState('');
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const userDocId = getUserDocId(admin);

  // Los permisos base del rol se toman del catalogo del CODIGO (`PERMISOS_POR_ROL`),
  // la misma fuente que usa el runtime en `normalizarAccesoUsuario`. Es la fuente
  // de verdad: Administrador Global, por ejemplo, siempre tiene TODOS los
  // permisos (Object.values(PERMISOS)) sin importar si el doc de rol en Firebase
  // fue sincronizado despues de agregar permisos nuevos al catalogo. El doc de
  // Firebase solo se usa como respaldo si el rol no existe en el codigo.
  const roleId = String(access?.rolId || admin?.rolId || admin?.role || '').trim();
  const rolePermissions = uniqueList(
    PERMISOS_POR_ROL[roleId] || access?.rol?.permisos || admin?.permisosRol || []
  );
  const activePermissions = uniqueList([...rolePermissions, ...directPermissions]).filter(
    (permission) => !excludedPermissions.includes(permission)
  );
  const missingPermissions = PERMISOS_CATALOGO.map((permission) => permission.codigo).filter(
    (permission) => !activePermissions.includes(permission)
  );

  useEffect(() => {
    let isMounted = true;

    const loadAccess = async () => {
      setLoading(true);
      setError('');

      try {
        const result = userDocId ? await obtenerAccesoUsuario(userDocId) : null;

        if (isMounted) {
          setAccess(result);
          setDirectPermissions(uniqueList(result?.permisosDirectos || []));
          setExcludedPermissions(uniqueList(result?.permisosExcluidos || []));
          setPermissionsMetadata(result?.permisosMetadata || {});
        }
      } catch (loadError) {
        console.error(loadError);

        if (isMounted) {
          setError(loadError.message || 'No se pudieron cargar los permisos.');
          setAccess(null);
          setDirectPermissions([]);
          setExcludedPermissions([]);
          setPermissionsMetadata({});
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    if (open) {
      loadAccess();
    }

    return () => {
      isMounted = false;
    };
  }, [open, userDocId]);

  const applyAddPermission = (permissionCode, extraMetadata = {}) => {
    if (!permissionCode) return;

    setExcludedPermissions((current) => current.filter((permission) => permission !== permissionCode));

    if (!rolePermissions.includes(permissionCode)) {
      setDirectPermissions((current) => uniqueList([...current, permissionCode]));
    }

    setPermissionsMetadata((current) => ({
      ...current,
      [permissionCode]: {
        accion: 'agregado',
        fecha: new Date().toISOString(),
        por: user?.uid || user?.email || 'sistema',
        porNombre: user?.displayName || user?.name || user?.email || 'sistema',
        ...extraMetadata,
      },
    }));
  };

  const addPermission = (permissionCode) => {
    if (SENSITIVE_PERMISSIONS[permissionCode] && !activePermissions.includes(permissionCode)) {
      setSensitiveRequest(permissionCode);
      setSensitiveJustification('');
      return;
    }

    applyAddPermission(permissionCode);
  };

  const confirmSensitivePermission = () => {
    const permissionCode = sensitiveRequest;

    if (!permissionCode) return;

    if (!sensitiveJustification.trim()) {
      setError('Debes indicar una justificacion para otorgar este permiso sensible.');
      return;
    }

    setPermissionsMetadata((current) => ({
      ...current,
      [permissionCode]: {
        accion: 'pendiente',
        sensible: true,
        notificarOficinaNacional: true,
        justificacion: sensitiveJustification.trim(),
        fecha: new Date().toISOString(),
        por: user?.uid || user?.email || 'sistema',
        porNombre: user?.displayName || user?.name || user?.email || 'sistema',
      },
    }));
    setSensitiveRequest(null);
    setSensitiveJustification('');
    setError('');
    toast.success('Se envio una notificacion a Oficina Nacional para su aprobacion.');
  };

  const removePermission = (permissionCode) => {
    if (!permissionCode) return;

    setDirectPermissions((current) => current.filter((permission) => permission !== permissionCode));

    if (rolePermissions.includes(permissionCode)) {
      setExcludedPermissions((current) => uniqueList([...current, permissionCode]));
    }

    setPermissionsMetadata((current) => ({
      ...current,
      [permissionCode]: {
        accion: 'quitado',
        fecha: new Date().toISOString(),
        por: user?.uid || user?.email || 'sistema',
        porNombre: user?.displayName || user?.name || user?.email || 'sistema',
      },
    }));
  };

  const getActiveOrigin = (permissionCode) => {
    if (directPermissions.includes(permissionCode)) return 'directo';
    return 'rol';
  };

  const getMissingOrigin = (permissionCode) => {
    if (permissionsMetadata[permissionCode]?.accion === 'pendiente') return 'pendiente';
    return excludedPermissions.includes(permissionCode) ? 'excluido' : 'ninguno';
  };

  const getChangeInfo = (permissionCode) => permissionsMetadata[permissionCode] || null;
  const hasPermissionChanges =
    directPermissions.length > 0 || excludedPermissions.length > 0 || Object.keys(permissionsMetadata).length > 0;

  const resetToRoleDefaults = () => {
    setDirectPermissions([]);
    setExcludedPermissions([]);
    setPermissionsMetadata({});
    setConfirmResetOpen(false);
  };

  const handleSave = async () => {
    setSaving(true);

    try {
      const payload = await guardarPermisosDirectosUsuario({
        uidUsuario: userDocId,
        permisos: directPermissions,
        permisosExcluidos: excludedPermissions,
        permisosMetadata: permissionsMetadata,
        usuario: user,
      });

      onSaved?.({
        permisos: payload.permisos,
        permisosExcluidos: payload.permisosExcluidos,
      });

      toast.success('Permisos guardados correctamente.');
      onClose?.();
    } catch (saveError) {
      console.error(saveError);
      setError(saveError.message || 'No se pudieron guardar los permisos.');
      toast.error(saveError.message || 'No se pudieron guardar los permisos.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog fullWidth maxWidth="md" open={open} onClose={saving ? undefined : onClose}>
      <DialogTitle>
        Ver permisos
        <Box component="span" sx={{ ml: 1, typography: 'body2', color: 'text.secondary' }}>
          {admin?.name || admin?.email || ''}
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {loading ? (
          <Stack spacing={2}>
            <Skeleton variant="rounded" height={64} />
            <Skeleton variant="rounded" height={170} />
            <Skeleton variant="rounded" height={170} />
          </Stack>
        ) : (
          <Stack spacing={2.5}>
            {error ? <Alert severity="warning">{error}</Alert> : null}

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'flex-end' }}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  Rol
                </Typography>
                <Typography variant="subtitle2">{getRoleName(access, admin)}</Typography>
              </Box>

              <Box sx={{ flex: 1 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  Alcance
                </Typography>
                <Typography variant="subtitle2">{getScopeLabel(access?.alcance || admin?.alcance)}</Typography>
              </Box>

              <Button
                color="warning"
                variant="outlined"
                disabled={!hasPermissionChanges || saving}
                onClick={() => setConfirmResetOpen(true)}
                sx={{ whiteSpace: 'nowrap' }}
              >
                Restaurar rol original
              </Button>
            </Stack>

            <Divider />

            <Box
              sx={{
                gap: 2,
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
              }}
            >
              <PermissionDropZone
                title={`Tiene permisos (${activePermissions.length})`}
                subtitle="Arrastra aqui para agregar."
                permissions={activePermissions}
                getOrigin={getActiveOrigin}
                getChangeInfo={getChangeInfo}
                onDropPermission={addPermission}
                onMovePermission={removePermission}
              />

              <PermissionDropZone
                title={`No tiene permisos (${missingPermissions.length})`}
                subtitle="Arrastra aqui para quitar."
                permissions={missingPermissions}
                getOrigin={getMissingOrigin}
                getChangeInfo={getChangeInfo}
                onDropPermission={removePermission}
                onMovePermission={addPermission}
              />
            </Box>
          </Stack>
        )}
      </DialogContent>

      <DialogActions>
        <Button color="inherit" variant="outlined" disabled={saving} onClick={onClose}>
          Cancelar
        </Button>
        <LoadingButton variant="contained" loading={saving} disabled={loading || !userDocId} onClick={handleSave}>
          Guardar permisos
        </LoadingButton>
      </DialogActions>

      <Dialog
        fullWidth
        maxWidth="sm"
        open={Boolean(sensitiveRequest)}
        onClose={() => setSensitiveRequest(null)}
      >
        <DialogTitle>{SENSITIVE_PERMISSIONS[sensitiveRequest]?.title || 'Permiso sensible'}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Alert severity="warning">
              {SENSITIVE_PERMISSIONS[sensitiveRequest]?.message}
              <Box sx={{ mt: 1 }}>
                <Link component={RouterLink} href="/politicas-de-privacidad" target="_blank">
                  Políticas de Privacidad
                </Link>
              </Box>
            </Alert>
            <TextField
              multiline
              minRows={4}
              label="Justificacion"
              value={sensitiveJustification}
              onChange={(event) => setSensitiveJustification(event.target.value)}
              placeholder="Explica por qué esta persona necesita este permiso."
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button color="inherit" variant="outlined" onClick={() => setSensitiveRequest(null)}>
            Cancelar
          </Button>
          <Button variant="contained" onClick={confirmSensitivePermission}>
            Notificar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={confirmResetOpen} onClose={() => setConfirmResetOpen(false)}>
        <DialogTitle>Restaurar rol original</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2">
            Se eliminarán todos los permisos agregados o quitados manualmente para esta persona. El usuario
            volverá a tener únicamente los permisos heredados de su rol base.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button color="inherit" variant="outlined" onClick={() => setConfirmResetOpen(false)}>
            Cancelar
          </Button>
          <Button color="warning" variant="contained" onClick={resetToRoleDefaults}>
            Restaurar
          </Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
}
