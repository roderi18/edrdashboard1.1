'use client';

import { useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Switch from '@mui/material/Switch';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CardHeader from '@mui/material/CardHeader';
import LoadingButton from '@mui/lab/LoadingButton';
import CardContent from '@mui/material/CardContent';
import FormControlLabel from '@mui/material/FormControlLabel';

import { isMemberSessionUser } from 'src/utils/member-access';

import { Label } from 'src/components/label';
import { Iconify } from 'src/components/iconify';

import { useAuthContext } from 'src/auth/hooks';

// ----------------------------------------------------------------------

const ACCOUNT_SETTINGS_STORAGE_KEY = 'account-settings';

const DEFAULT_ACCOUNT_SETTINGS = {
  twoFactor: false,
  sessionAlerts: true,
  emailNotifications: true,
  internalNotifications: true,
  reminders: true,
  showEmail: false,
  showPhone: false,
  allowMessages: true,
  themeMode: 'Sistema',
  language: 'Espanol',
  timeZone: 'America/Caracas',
};

const readAccountSettings = () => {
  if (typeof window === 'undefined') return DEFAULT_ACCOUNT_SETTINGS;

  try {
    return {
      ...DEFAULT_ACCOUNT_SETTINGS,
      ...JSON.parse(window.localStorage.getItem(ACCOUNT_SETTINGS_STORAGE_KEY) || '{}'),
    };
  } catch {
    return DEFAULT_ACCOUNT_SETTINGS;
  }
};

// ----------------------------------------------------------------------

export function UserAccountSettings() {
  const { user } = useAuthContext();
  const [settings, setSettings] = useState(DEFAULT_ACCOUNT_SETTINGS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSettings(readAccountSettings());
  }, []);

  const handleChange = (name, value) => {
    setSettings((currentSettings) => ({
      ...currentSettings,
      [name]: value,
    }));
  };

  const handleSave = () => {
    setSaving(true);
    window.localStorage.setItem(ACCOUNT_SETTINGS_STORAGE_KEY, JSON.stringify(settings));

    window.setTimeout(() => {
      setSaving(false);
    }, 350);
  };

  const handleReset = () => {
    const nextSettings = { ...DEFAULT_ACCOUNT_SETTINGS };

    setSettings(nextSettings);
    window.localStorage.setItem(ACCOUNT_SETTINGS_STORAGE_KEY, JSON.stringify(nextSettings));
  };

  const renderTextField = ({ name, label, type = 'text', select = false, options = [] }) => (
    <TextField
      select={select}
      fullWidth
      type={type}
      label={label}
      value={settings[name]}
      onChange={(event) => handleChange(name, event.target.value)}
    >
      {options.map((option) => (
        <MenuItem key={option} value={option}>
          {option}
        </MenuItem>
      ))}
    </TextField>
  );

  const renderSwitch = (name, label) => (
    <FormControlLabel
      control={
        <Switch
          checked={Boolean(settings[name])}
          onChange={(event) => handleChange(name, event.target.checked)}
        />
      }
      label={label}
      sx={{
        m: 0,
        width: 1,
        justifyContent: 'space-between',
        '& .MuiFormControlLabel-label': { typography: 'body2', color: 'text.secondary' },
      }}
    />
  );

  return (
    <Stack spacing={3}>
      <Alert
        severity="warning"
        variant="outlined"
        icon={<Iconify icon="solar:database-bold-duotone" />}
      >
        Configuracion LocalH: estos cambios se guardan solo en este navegador con localStorage. Aun
        no sincronizan con Firebase.
      </Alert>

      <Card>
        <CardHeader
          title="Configuracion LocalH"
          subheader="Preferencias locales de cuenta"
          action={<Label color="warning">Local</Label>}
        />
        <CardContent>
          <Box sx={{ display: 'grid', gap: 3 }}>
            <Box
              sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}
            >
              <Stack spacing={1.5}>
                <Typography variant="overline" sx={{ color: 'text.disabled' }}>
                  Seguridad
                </Typography>
                {renderSwitch('twoFactor', 'Autenticacion en dos pasos')}
                {renderSwitch('sessionAlerts', 'Alertas de inicio de sesion')}
                <Button
                  variant="outlined"
                  color="inherit"
                  startIcon={<Iconify icon="solar:key-bold" />}
                >
                  Cambiar contrasena
                </Button>
              </Stack>

              <Stack spacing={1.5}>
                <Typography variant="overline" sx={{ color: 'text.disabled' }}>
                  Notificaciones
                </Typography>
                {renderSwitch('emailNotifications', 'Correo electronico')}
                {renderSwitch('internalNotifications', 'Notificaciones internas')}
                {renderSwitch('reminders', 'Recordatorios')}
              </Stack>
            </Box>

            <Divider sx={{ borderStyle: 'dashed' }} />

            <Box
              sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}
            >
              <Stack spacing={1.5}>
                <Typography variant="overline" sx={{ color: 'text.disabled' }}>
                  Privacidad
                </Typography>
                {renderSwitch('showEmail', 'Mostrar correo en perfil')}
                {renderSwitch('showPhone', 'Mostrar telefono en perfil')}
                {renderSwitch('allowMessages', 'Permitir mensajes')}
              </Stack>

              <Stack spacing={2}>
                <Typography variant="overline" sx={{ color: 'text.disabled' }}>
                  Preferencias
                </Typography>
                {renderTextField({
                  select: true,
                  name: 'themeMode',
                  label: 'Tema',
                  options: ['Sistema', 'Claro', 'Oscuro'],
                })}
                {renderTextField({
                  select: true,
                  name: 'language',
                  label: 'Idioma',
                  options: ['Espanol', 'English'],
                })}
                {renderTextField({
                  select: true,
                  name: 'timeZone',
                  label: 'Zona horaria',
                  options: ['America/Caracas', 'America/Santo_Domingo', 'America/New_York'],
                })}
              </Stack>
            </Box>

            <Divider sx={{ borderStyle: 'dashed' }} />

            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1.5}
              justifyContent="space-between"
            >
              <Box>
                <Typography variant="overline" sx={{ color: 'text.disabled' }}>
                  Rol y permisos
                </Typography>
                <Box sx={{ mt: 1, gap: 1, display: 'flex', flexWrap: 'wrap' }}>
                  <Label color="info">Usuario</Label>
                  {!isMemberSessionUser(user) && <Label color="success">Administrador</Label>}
                  <Label color="default">LocalH</Label>
                </Box>
              </Box>

              <Stack direction="row" spacing={1}>
                <Button variant="outlined" color="inherit">
                  Descargar
                </Button>
                <Button variant="outlined" color="inherit">
                  Correccion
                </Button>
              </Stack>
            </Stack>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="flex-end">
              <Button color="inherit" variant="text" onClick={handleReset}>
                Restaurar valores locales
              </Button>
              <LoadingButton
                variant="contained"
                loading={saving}
                onClick={handleSave}
                startIcon={<Iconify icon="solar:diskette-bold" />}
              >
                Guardar local
              </LoadingButton>
            </Stack>
          </Box>
        </CardContent>
      </Card>
    </Stack>
  );
}
