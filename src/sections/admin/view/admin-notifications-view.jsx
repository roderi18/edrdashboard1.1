'use client';

import { useRef, useMemo, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Card from '@mui/material/Card';
import Tabs from '@mui/material/Tabs';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import InputAdornment from '@mui/material/InputAdornment';
import FormControlLabel from '@mui/material/FormControlLabel';

import {
  listarConfiguracionNotificaciones,
  guardarConfiguracionTipoNotificacion,
  guardarPreferenciaDestinatarioNotificacion,
} from 'src/services/notification-settings-service';

import { Label } from 'src/components/label';
import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

const PRIORIDAD_OPTIONS = [
  { value: 'informativa', label: 'Informativa' },
  { value: 'importante', label: 'Importante' },
  { value: 'critica', label: 'Critica' },
];

const ACCION_OPTIONS = [
  { value: 'ver', label: 'Ver' },
  { value: 'responder', label: 'Responder' },
  { value: 'revisar', label: 'Revisar' },
];

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Administradores' },
  { value: 'usuario', label: 'Usuarios' },
];

const DEFAULT_PARAMETROS = {
  retencionDias: 90,
  limitePorDia: 0,
  minutosEsperaDuplicado: 0,
};

const toReadableName = (value = '') => {
  const text = String(value || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  return text ? text.charAt(0).toUpperCase() + text.slice(1) : '';
};

const formatNotificationLabel = (value = '') => {
  const text = String(value || '').trim();

  return /[_-]/.test(text) ? toReadableName(text) : text;
};

const normalizeRoles = (roles = []) =>
  Array.isArray(roles) && roles.length ? roles : ['admin'];

const normalizeForm = (tipo = {}, plantilla = {}) => ({
  tipoNotificacion: tipo.tipoNotificacion || plantilla.tipoNotificacion || tipo.id || '',
  activa: tipo.activa !== false && plantilla.activa !== false,
  modulo: tipo.modulo || plantilla.modulo || '',
  titulo: formatNotificationLabel(tipo.titulo || plantilla.tituloPlantilla || tipo.tipoNotificacion || tipo.id),
  tituloPlantilla: formatNotificationLabel(
    plantilla.tituloPlantilla || tipo.titulo || tipo.tipoNotificacion || tipo.id
  ),
  mensajePlantilla: plantilla.mensajePlantilla || '',
  prioridadPorDefecto:
    plantilla.prioridadPorDefecto || tipo.prioridadPorDefecto || 'informativa',
  entidadTipo: tipo.entidadTipo || '',
  etiquetaAccion: plantilla.etiquetaAccionPorDefecto || tipo.etiquetaAccion || 'Ver',
  tipoAccion: plantilla.tipoAccionPorDefecto || tipo.tipoAccion || 'ver',
  requiereFotoPersona: Boolean(tipo.requiereFotoPersona || plantilla.requiereFotoPersona),
  rolesDisponibles: normalizeRoles(tipo.rolesDisponibles),
  parametros: {
    ...DEFAULT_PARAMETROS,
    ...(tipo.parametros || {}),
  },
});

const countActiveTypes = (tipos) => tipos.filter((tipo) => tipo.activa !== false).length;

const getPreferenceValue = (preferencia, tipoNotificacion) =>
  preferencia?.tiposNotificacion?.[tipoNotificacion] !== false;

const getNotificationDisplayName = (tipo = {}, plantilla = {}, fallback = '') =>
  formatNotificationLabel(
    tipo.titulo || plantilla.tituloPlantilla || tipo.tipoNotificacion || tipo.id || fallback
  );

const normalizeSearch = (value = '') =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const formatRole = (role = '') => {
  if (role === 'admin') return 'Administrador';
  if (role === 'usuario') return 'Usuario';
  return toReadableName(role);
};

export function AdminNotificationsView() {
  const scrollPositionRef = useRef(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [recipientSavingId, setRecipientSavingId] = useState('');
  const [currentTab, setCurrentTab] = useState('configuracion');
  const [selectedType, setSelectedType] = useState('');
  const [typeSearch, setTypeSearch] = useState('');
  const [recipientSearch, setRecipientSearch] = useState('');
  const [tipos, setTipos] = useState([]);
  const [plantillas, setPlantillas] = useState([]);
  const [preferencias, setPreferencias] = useState([]);
  const [destinatarios, setDestinatarios] = useState([]);
  const [form, setForm] = useState(() => normalizeForm());

  const plantillasByType = useMemo(
    () => new Map(plantillas.map((plantilla) => [plantilla.tipoNotificacion || plantilla.id, plantilla])),
    [plantillas]
  );

  const preferenciasByUser = useMemo(
    () => new Map(preferencias.map((preferencia) => [String(preferencia.idUsuario || preferencia.id), preferencia])),
    [preferencias]
  );

  const selectedTipo = useMemo(
    () => tipos.find((tipo) => (tipo.tipoNotificacion || tipo.id) === selectedType) || null,
    [selectedType, tipos]
  );

  const selectedPlantilla = useMemo(
    () => plantillasByType.get(selectedType) || null,
    [plantillasByType, selectedType]
  );

  const filteredTipos = useMemo(() => {
    const search = normalizeSearch(typeSearch);

    if (!search) return tipos;

    return tipos.filter((tipo) => {
      const tipoKey = tipo.tipoNotificacion || tipo.id;
      const plantilla = plantillasByType.get(tipoKey) || {};
      const haystack = normalizeSearch(
        `${tipoKey} ${getNotificationDisplayName(tipo, plantilla, tipoKey)} ${tipo.modulo || ''}`
      );

      return haystack.includes(search);
    });
  }, [plantillasByType, typeSearch, tipos]);

  const loadSettings = useCallback(async () => {
    setLoading(true);

    try {
      const data = await listarConfiguracionNotificaciones();
      const sortedTypes = data.tipos.sort((a, b) =>
        String(a.tipoNotificacion || a.id).localeCompare(String(b.tipoNotificacion || b.id))
      );

      setTipos(sortedTypes);
      setPlantillas(data.plantillas);
      setPreferencias(data.preferencias);
      setDestinatarios(data.destinatarios);

      const firstType = sortedTypes[0]?.tipoNotificacion || sortedTypes[0]?.id || '';
      const firstPlantilla =
        data.plantillas.find((plantilla) => (plantilla.tipoNotificacion || plantilla.id) === firstType) ||
        {};

      setSelectedType(firstType);
      setForm(normalizeForm(sortedTypes[0] || {}, firstPlantilla));
    } catch (error) {
      console.error(error);
      toast.error(error.message || 'No se pudo cargar la configuracion.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleSelectType = useCallback(
    (tipoKey) => {
      if (!tipoKey || tipoKey === selectedType) return;

      const nextTipo = tipos.find((tipo) => (tipo.tipoNotificacion || tipo.id) === tipoKey) || {};
      const nextPlantilla = plantillasByType.get(tipoKey) || {};

      setSelectedType(tipoKey);
      setForm(normalizeForm(nextTipo, nextPlantilla));
    },
    [plantillasByType, selectedType, tipos]
  );

  const handleFieldChange = useCallback((field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  }, []);

  const handleChangeTab = useCallback((_event, value) => {
    scrollPositionRef.current = window.scrollY;
    setCurrentTab(value);

    requestAnimationFrame(() => {
      window.scrollTo({ top: scrollPositionRef.current, left: 0, behavior: 'auto' });
    });
  }, []);

  const handleParameterChange = useCallback((field, value) => {
    const numberValue = Number(value);

    setForm((current) => ({
      ...current,
      parametros: {
        ...current.parametros,
        [field]: Number.isFinite(numberValue) ? numberValue : 0,
      },
    }));
  }, []);

  const handleRoleToggle = useCallback((role) => {
    setForm((current) => {
      const currentRoles = new Set(current.rolesDisponibles);

      if (currentRoles.has(role)) {
        currentRoles.delete(role);
      } else {
        currentRoles.add(role);
      }

      return {
        ...current,
        rolesDisponibles: Array.from(currentRoles),
      };
    });
  }, []);

  const handleSave = useCallback(async () => {
    if (!form.tipoNotificacion) return;

    setSaving(true);

    try {
      await guardarConfiguracionTipoNotificacion({
        tipoNotificacion: form.tipoNotificacion,
        tipo: {
          modulo: form.modulo,
          titulo: form.titulo,
          activa: form.activa,
          rolesDisponibles: form.rolesDisponibles,
          prioridadPorDefecto: form.prioridadPorDefecto,
          entidadTipo: form.entidadTipo,
          requiereFotoPersona: form.requiereFotoPersona,
          parametros: form.parametros,
        },
        plantilla: {
          modulo: form.modulo,
          activa: form.activa,
          tituloPlantilla: form.tituloPlantilla,
          mensajePlantilla: form.mensajePlantilla,
          prioridadPorDefecto: form.prioridadPorDefecto,
          etiquetaAccionPorDefecto: form.etiquetaAccion,
          tipoAccionPorDefecto: form.tipoAccion,
          requiereFotoPersona: form.requiereFotoPersona,
        },
      });

      setTipos((current) =>
        current.map((tipo) =>
          (tipo.tipoNotificacion || tipo.id) === form.tipoNotificacion
            ? {
                ...tipo,
                modulo: form.modulo,
                titulo: form.titulo,
                activa: form.activa,
                rolesDisponibles: form.rolesDisponibles,
                prioridadPorDefecto: form.prioridadPorDefecto,
                entidadTipo: form.entidadTipo,
                requiereFotoPersona: form.requiereFotoPersona,
                parametros: form.parametros,
              }
            : tipo
        )
      );
      setPlantillas((current) => {
        const nextPlantilla = {
          ...(selectedPlantilla || {}),
          tipoNotificacion: form.tipoNotificacion,
          modulo: form.modulo,
          activa: form.activa,
          tituloPlantilla: form.tituloPlantilla,
          mensajePlantilla: form.mensajePlantilla,
          prioridadPorDefecto: form.prioridadPorDefecto,
          etiquetaAccionPorDefecto: form.etiquetaAccion,
          tipoAccionPorDefecto: form.tipoAccion,
          requiereFotoPersona: form.requiereFotoPersona,
        };
        const exists = current.some(
          (plantilla) => (plantilla.tipoNotificacion || plantilla.id) === form.tipoNotificacion
        );

        return exists
          ? current.map((plantilla) =>
              (plantilla.tipoNotificacion || plantilla.id) === form.tipoNotificacion
                ? nextPlantilla
                : plantilla
            )
          : [...current, nextPlantilla];
      });

      toast.success('Configuracion guardada.');
    } catch (error) {
      console.error(error);
      toast.error(error.message || 'No se pudo guardar la configuracion.');
    } finally {
      setSaving(false);
    }
  }, [form, selectedPlantilla]);

  const handleToggleRecipient = useCallback(
    async (destinatario, activo) => {
      if (!form.tipoNotificacion) return;

      setRecipientSavingId(destinatario.idUsuario);

      try {
        await guardarPreferenciaDestinatarioNotificacion({
          idUsuario: destinatario.idUsuario,
          rol: destinatario.rol,
          tipoNotificacion: form.tipoNotificacion,
          activo,
        });

        setPreferencias((current) => {
          const idUsuario = String(destinatario.idUsuario);
          const currentPreference =
            current.find((preferencia) => String(preferencia.idUsuario || preferencia.id) === idUsuario) ||
            {};
          const nextPreference = {
            ...currentPreference,
            id: currentPreference.id || idUsuario,
            idUsuario,
            rol: destinatario.rol,
            tiposNotificacion: {
              ...(currentPreference.tiposNotificacion || {}),
              [form.tipoNotificacion]: Boolean(activo),
            },
          };
          const exists = current.some(
            (preferencia) => String(preferencia.idUsuario || preferencia.id) === idUsuario
          );

          return exists
            ? current.map((preferencia) =>
                String(preferencia.idUsuario || preferencia.id) === idUsuario
                  ? nextPreference
                  : preferencia
              )
            : [...current, nextPreference];
        });

        toast.success('Destinatario actualizado.');
      } catch (error) {
        console.error(error);
        toast.error(error.message || 'No se pudo actualizar el destinatario.');
      } finally {
        setRecipientSavingId('');
      }
    },
    [form.tipoNotificacion]
  );

  const recipientRows = useMemo(
    () =>
      destinatarios
        .map((destinatario) => {
          const preferencia = preferenciasByUser.get(String(destinatario.idUsuario));
          const roleAllowed = form.rolesDisponibles.includes(destinatario.rol);

          return {
            ...destinatario,
            roleAllowed,
            recibe: roleAllowed && getPreferenceValue(preferencia, form.tipoNotificacion),
          };
        })
        .filter((destinatario) => {
          const search = normalizeSearch(recipientSearch);

          if (!search) return true;

          return normalizeSearch(
            `${destinatario.nombre} ${destinatario.correo} ${destinatario.idUsuario} ${destinatario.rol}`
          ).includes(search);
        }),
    [
      destinatarios,
      form.rolesDisponibles,
      form.tipoNotificacion,
      preferenciasByUser,
      recipientSearch,
    ]
  );

  const selectedDisplayName = getNotificationDisplayName(
    selectedTipo || {},
    selectedPlantilla || {},
    form.tipoNotificacion
  );

  if (loading) {
    return (
      <Card sx={{ p: 3 }}>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Cargando configuracion de notificaciones...
        </Typography>
      </Card>
    );
  }

  return (
    <Stack spacing={3}>
      <Box
        sx={{
          gap: { xs: 1.5, md: 2 },
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, 1fr)' },
        }}
      >
        <SummaryStat label="Tipos" value={tipos.length} />
        <SummaryStat label="Activas" value={countActiveTypes(tipos)} />
        <SummaryStat label="Plantillas" value={plantillas.length} />
        <SummaryStat label="Destinatarios" value={destinatarios.length} />
      </Box>

      <Card>
        <Tabs value={currentTab} onChange={handleChangeTab} sx={{ px: 3 }}>
          <Tab value="configuracion" label="Configuración" />
          <Tab value="destinatarios" label="Destinatarios" />
        </Tabs>
        <Divider />

        {currentTab === 'configuracion' && (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: '320px 1fr' },
              height: { xs: 560, sm: 620, md: 'calc(100vh - 240px)' },
              minHeight: { xs: 0, md: 700 },
              maxHeight: { md: 860 },
            }}
          >
            <Box
              sx={{
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
                borderRight: { md: (theme) => `1px solid ${theme.palette.divider}` },
              }}
            >
              <Box sx={{ p: 2, pb: 1 }}>
                <TextField
                  fullWidth
                  size="small"
                  value={typeSearch}
                  placeholder="Buscar notificación"
                  onChange={(event) => setTypeSearch(event.target.value)}
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <Iconify icon="eva:search-fill" sx={{ color: 'text.disabled' }} />
                        </InputAdornment>
                      ),
                    },
                  }}
                />
              </Box>

              <Stack
                spacing={0.5}
                sx={{
                  px: 2,
                  pb: 2,
                  minHeight: 0,
                  overflowY: 'auto',
                }}
              >
                {filteredTipos.map((tipo) => {
                  const tipoKey = tipo.tipoNotificacion || tipo.id;
                  const plantilla = plantillasByType.get(tipoKey) || {};
                  const selected = tipoKey === selectedType;

                  return (
                    <Button
                      key={tipoKey}
                      color={selected ? 'primary' : 'inherit'}
                      disableFocusRipple
                      disableRipple
                      variant={selected ? 'soft' : 'text'}
                      onClick={() => handleSelectType(tipoKey)}
                      sx={{
                        gap: 1,
                        px: 1.5,
                        minHeight: 44,
                        transition: (theme) =>
                          theme.transitions.create(['background-color', 'color'], {
                            duration: theme.transitions.duration.shortest,
                          }),
                        justifyContent: 'space-between',
                      }}
                    >
                      <Box
                        component="span"
                        sx={{
                          minWidth: 0,
                          overflow: 'hidden',
                          textAlign: 'left',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {getNotificationDisplayName(tipo, plantilla, tipoKey)}
                      </Box>
                      <Label color={tipo.activa === false ? 'default' : 'success'}>
                        {tipo.activa === false ? 'Inactiva' : 'Activa'}
                      </Label>
                    </Button>
                  );
                })}

                {!filteredTipos.length && (
                  <Typography variant="body2" sx={{ py: 2, color: 'text.secondary' }}>
                    No hay notificaciones con ese filtro.
                  </Typography>
                )}
              </Stack>
            </Box>

            <Stack
              spacing={3}
              sx={{
                p: 3,
                minHeight: 0,
                overflowY: 'auto',
              }}
            >
              <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
                <Box>
                  <Typography variant="h6">{selectedDisplayName}</Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {form.modulo || 'Modulo sin definir'}
                  </Typography>
                </Box>
                <FormControlLabel
                  control={
                    <Switch
                      checked={form.activa}
                      onChange={(event) => handleFieldChange('activa', event.target.checked)}
                    />
                  }
                  label={form.activa ? 'Activa' : 'Inactiva'}
                />
              </Stack>

              <Box
                sx={{
                  gap: 2,
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
                }}
              >
                <TextField
                  label="Modulo"
                  value={form.modulo}
                  onChange={(event) => handleFieldChange('modulo', event.target.value)}
                />
                <TextField
                  label="Entidad"
                  value={form.entidadTipo}
                  onChange={(event) => handleFieldChange('entidadTipo', event.target.value)}
                />
                <TextField
                  label="Titulo tecnico"
                  value={form.titulo}
                  onChange={(event) => handleFieldChange('titulo', event.target.value)}
                />
                <TextField
                  select
                  label="Prioridad"
                  value={form.prioridadPorDefecto}
                  onChange={(event) =>
                    handleFieldChange('prioridadPorDefecto', event.target.value)
                  }
                >
                  {PRIORIDAD_OPTIONS.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  label="Titulo visible"
                  value={form.tituloPlantilla}
                  onChange={(event) => handleFieldChange('tituloPlantilla', event.target.value)}
                />
                <TextField
                  label="Texto del boton"
                  value={form.etiquetaAccion}
                  onChange={(event) => handleFieldChange('etiquetaAccion', event.target.value)}
                />
                <TextField
                  select
                  label="Tipo de accion"
                  value={form.tipoAccion}
                  onChange={(event) => handleFieldChange('tipoAccion', event.target.value)}
                >
                  {ACCION_OPTIONS.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </TextField>
                <FormControlLabel
                  control={
                    <Switch
                      checked={form.requiereFotoPersona}
                      onChange={(event) =>
                        handleFieldChange('requiereFotoPersona', event.target.checked)
                      }
                    />
                  }
                  label="Usa foto de persona"
                />
              </Box>

              <TextField
                multiline
                minRows={4}
                label="Mensaje plantilla"
                value={form.mensajePlantilla}
                onChange={(event) => handleFieldChange('mensajePlantilla', event.target.value)}
              />

              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {ROLE_OPTIONS.map((role) => (
                  <Chip
                    key={role.value}
                    clickable
                    color={form.rolesDisponibles.includes(role.value) ? 'primary' : 'default'}
                    variant={form.rolesDisponibles.includes(role.value) ? 'filled' : 'outlined'}
                    label={role.label}
                    onClick={() => handleRoleToggle(role.value)}
                  />
                ))}
              </Stack>

              <Box
                sx={{
                  gap: 2,
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
                }}
              >
                <TextField
                  type="number"
                  label="Retencion en dias"
                  value={form.parametros.retencionDias}
                  onChange={(event) => handleParameterChange('retencionDias', event.target.value)}
                />
                <TextField
                  type="number"
                  label="Limite por dia"
                  value={form.parametros.limitePorDia}
                  onChange={(event) => handleParameterChange('limitePorDia', event.target.value)}
                />
                <TextField
                  type="number"
                  label="Minutos anti duplicado"
                  value={form.parametros.minutosEsperaDuplicado}
                  onChange={(event) =>
                    handleParameterChange('minutosEsperaDuplicado', event.target.value)
                  }
                />
              </Box>

              <Stack
                direction="row"
                justifyContent="flex-end"
                sx={{
                  py: 2,
                  bottom: { md: 0 },
                  position: { xs: 'static', md: 'sticky' },
                  bgcolor: 'background.paper',
                  borderTop: (theme) => `1px solid ${theme.palette.divider}`,
                }}
              >
                <LoadingButton
                  loading={saving}
                  variant="contained"
                  startIcon={<Iconify icon="solar:diskette-bold" />}
                  onClick={handleSave}
                >
                  Guardar cambios
                </LoadingButton>
              </Stack>
            </Stack>
          </Box>
        )}

        {currentTab === 'destinatarios' && (
          <Stack sx={{ p: 3 }}>
            <TextField
              fullWidth
              size="small"
              value={recipientSearch}
              placeholder="Buscar destinatario"
              onChange={(event) => setRecipientSearch(event.target.value)}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <Iconify icon="eva:search-fill" sx={{ color: 'text.disabled' }} />
                    </InputAdornment>
                  ),
                },
              }}
              sx={{ mb: 2 }}
            />

            <Stack divider={<Divider />} sx={{ maxHeight: 560, overflowY: 'auto' }}>
              {recipientRows.map((destinatario) => (
                <Stack
                  key={destinatario.idUsuario}
                  direction={{ xs: 'column', sm: 'row' }}
                  alignItems={{ xs: 'flex-start', sm: 'center' }}
                  justifyContent="space-between"
                  spacing={2}
                  sx={{ py: 1.5 }}
                >
                  <Box>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="subtitle2">{destinatario.nombre}</Typography>
                      <Label color={destinatario.rol === 'admin' ? 'primary' : 'default'}>
                        {formatRole(destinatario.rol)}
                      </Label>
                    </Stack>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      {destinatario.correo || destinatario.idUsuario}
                    </Typography>
                  </Box>

                  <FormControlLabel
                    control={
                      <Switch
                        disabled={
                          !destinatario.roleAllowed ||
                          recipientSavingId === destinatario.idUsuario
                        }
                        checked={destinatario.recibe}
                        onChange={(event) =>
                          handleToggleRecipient(destinatario, event.target.checked)
                        }
                      />
                    }
                    label={destinatario.recibe ? 'Recibe este tipo' : 'No recibe este tipo'}
                  />
                </Stack>
              ))}
            </Stack>
          </Stack>
        )}
      </Card>
    </Stack>
  );
}

function SummaryStat({ label, value }) {
  return (
    <Card sx={{ p: { xs: 1.5, md: 2 } }}>
      <Typography variant="h4" sx={{ fontSize: { xs: 24, md: 32 } }}>
        {value}
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        {label}
      </Typography>
    </Card>
  );
}
