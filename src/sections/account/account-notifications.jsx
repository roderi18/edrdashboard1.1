'use client';

import { useMemo, useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import Alert from '@mui/material/Alert';
import Switch from '@mui/material/Switch';
import ListItemText from '@mui/material/ListItemText';
import FormControlLabel from '@mui/material/FormControlLabel';

import { estaActivo, agruparTiposPorModulo } from 'src/utils/modulos-notificaciones.mjs';
import { activarWebPush, desactivarWebPush, consultarEstadoWebPush } from 'src/utils/web-push-client';
import {
  TIPOS_NOTIFICACIONES_ADMIN,
  TIPOS_NOTIFICACIONES_USUARIO,
  obtenerDefinicionNotificacion,
} from 'src/utils/firebase-notificaciones';

import {
  leerPreferenciasNotificaciones,
  guardarPreferenciaDestinatarioNotificacion,
} from 'src/services/notification-settings-service';

import { toast } from 'src/components/snackbar';

import { useAuthContext } from 'src/auth/hooks';

// ----------------------------------------------------------------------

// LOS AVISOS DE VERDAD, NO LOS DE LA PLANTILLA.
//
// Esta pantalla enseñaba textos de ejemplo en inglés y el botón "Save changes"
// no guardaba nada. Ahora lista los avisos del catálogo que le pueden llegar a
// esta cuenta, agrupados por módulo, y cada interruptor se guarda al momento en
// `preferencias_notificaciones/{uid}`: el mismo documento que se consulta al
// repartir cada aviso, así que apagarlo aquí deja de mandarlo de verdad.

const esAdministrador = (user = {}) =>
  ['admin', 'administrador', 'administrator'].includes(
    String(user?.role ?? user?.rol ?? '')
      .trim()
      .toLowerCase()
  );

export function AccountNotifications({ sx, ...other }) {
  const { user } = useAuthContext();
  const idUsuario = String(user?.uid ?? user?.id ?? '');
  const rol = esAdministrador(user) ? 'admin' : 'usuario';

  const [preferencias, setPreferencias] = useState(null);
  const [guardando, setGuardando] = useState('');
  const [estadoPush, setEstadoPush] = useState({ cargando: true, compatible: false, permiso: 'default', habilitadas: false });
  const [cambiandoPush, setCambiandoPush] = useState(false);

  useEffect(() => {
    let activo = true;

    if (!idUsuario) return undefined;

    leerPreferenciasNotificaciones(idUsuario)
      .then((leidas) => activo && setPreferencias(leidas))
      .catch((error) => {
        console.error('[notificaciones] no se pudieron leer las preferencias', error);
        if (activo) setPreferencias({});
      });

    return () => {
      activo = false;
    };
  }, [idUsuario]);

  useEffect(() => {
    let activo = true;
    consultarEstadoWebPush()
      .then((estado) => activo && setEstadoPush({ ...estado, cargando: false }))
      .catch((error) => {
        console.warn('[push] no se pudo consultar el dispositivo', error);
        if (activo) setEstadoPush({ cargando: false, compatible: false, permiso: 'unsupported', habilitadas: false });
      });
    return () => { activo = false; };
  }, []);

  const cambiarPush = async (habilitadas) => {
    setCambiandoPush(true);
    try {
      if (habilitadas) await activarWebPush();
      else await desactivarWebPush();
      setEstadoPush((estado) => ({ ...estado, permiso: Notification.permission, habilitadas }));
      toast.success(habilitadas ? 'Notificaciones activadas en este dispositivo.' : 'Notificaciones desactivadas en este dispositivo.');
    } catch (error) {
      toast.error(error.message || 'No se pudo actualizar la configuración del dispositivo.');
      setEstadoPush((estado) => ({
        ...estado,
        permiso: Notification.permission,
        habilitadas: !habilitadas,
      }));
    } finally {
      setCambiandoPush(false);
    }
  };

  // Solo los avisos que a esta cuenta le pueden llegar.
  const grupos = useMemo(() => {
    const tipos = rol === 'admin' ? TIPOS_NOTIFICACIONES_ADMIN : TIPOS_NOTIFICACIONES_USUARIO;

    return agruparTiposPorModulo(
      tipos
        .map((tipoNotificacion) => ({
          tipoNotificacion,
          ...(obtenerDefinicionNotificacion(tipoNotificacion) ?? {}),
        }))
        .filter((tipo) => tipo.titulo)
    );
  }, [rol]);

  const cambiar = async (tipoNotificacion, activo) => {
    const anterior = preferencias;

    // Se ve al momento; si no se guarda, vuelve atrás.
    setPreferencias((actual) => ({
      ...(actual ?? {}),
      tiposNotificacion: { ...(actual?.tiposNotificacion ?? {}), [tipoNotificacion]: activo },
    }));

    try {
      setGuardando(tipoNotificacion);
      await guardarPreferenciaDestinatarioNotificacion({
        idUsuario,
        rol,
        tipoNotificacion,
        activo,
        usuario: user,
      });
    } catch (error) {
      console.error('[notificaciones] no se pudo guardar la preferencia', error);
      setPreferencias(anterior);
      toast.error('No se pudo guardar el cambio.');
    } finally {
      setGuardando('');
    }
  };

  return (
    <Card
      sx={[
        { p: 3, gap: 3, display: 'flex', flexDirection: 'column' },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
      {...other}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <FormControlLabel
          label="Notificaciones en este dispositivo"
          labelPlacement="start"
          control={
            <Switch
              checked={estadoPush.habilitadas}
              disabled={
                estadoPush.cargando ||
                !estadoPush.compatible ||
                estadoPush.permiso === 'denied' ||
                cambiandoPush
              }
              onChange={(evento) => cambiarPush(evento.target.checked)}
              slotProps={{ input: { 'aria-label': 'Notificaciones en este dispositivo' } }}
            />
          }
          sx={{ m: 0, width: 1, justifyContent: 'space-between' }}
        />
        <Alert severity={estadoPush.permiso === 'denied' ? 'warning' : estadoPush.compatible ? 'info' : 'warning'}>
          {estadoPush.permiso === 'denied'
            ? 'El navegador bloqueó las notificaciones. Habilítalas desde los ajustes del sitio y vuelve a intentarlo.'
            : estadoPush.compatible
              ? 'Activa esta opción para recibir avisos del sistema en este dispositivo. Debes permitirlos cuando el navegador lo solicite.'
              : 'Este navegador no admite notificaciones push. En iPhone o iPad, abre la app instalada desde la pantalla de inicio.'}
        </Alert>
      </Box>

      <Alert severity="info">
        Elige qué avisos quieres recibir en la campana. Los cambios se guardan al momento.
      </Alert>

      {grupos.map((grupo) => (
        <Grid key={grupo.modulo} container spacing={3}>
          <Grid size={{ xs: 12, md: 4 }}>
            <ListItemText
              primary={grupo.titulo}
              secondary={grupo.descripcion}
              slotProps={{
                primary: { sx: { typography: 'h6' } },
                secondary: { sx: { mt: 0.5 } },
              }}
            />
          </Grid>

          <Grid size={{ xs: 12, md: 8 }}>
            <Box
              sx={{
                p: 3,
                gap: 1,
                borderRadius: 2,
                display: 'flex',
                flexDirection: 'column',
                bgcolor: 'background.neutral',
              }}
            >
              {grupo.tipos.map((tipo) => (
                <FormControlLabel
                  key={tipo.tipoNotificacion}
                  label={tipo.titulo}
                  labelPlacement="start"
                  control={
                    <Switch
                      disabled={!preferencias || guardando === tipo.tipoNotificacion}
                      checked={estaActivo(preferencias ?? {}, tipo.tipoNotificacion)}
                      onChange={(evento) => cambiar(tipo.tipoNotificacion, evento.target.checked)}
                      slotProps={{ input: { 'aria-label': tipo.titulo } }}
                    />
                  }
                  sx={{ m: 0, width: 1, justifyContent: 'space-between' }}
                />
              ))}
            </Box>
          </Grid>
        </Grid>
      ))}
    </Card>
  );
}
