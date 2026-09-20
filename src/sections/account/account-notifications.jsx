'use client';

import { useRef, useMemo, useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
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

import { AUTH } from 'src/lib/firebase';
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

  const [preferencias, setPreferencias] = useState({});
  const [estadoPush, setEstadoPush] = useState({ cargando: true, compatible: false, permiso: 'default', habilitadas: false });
  const preferenciasCambios = useRef(0);
  const preferenciasVersion = useRef(new Map());
  const preferenciasLocales = useRef(new Map());
  const preferenciasCola = useRef(new Map());
  const pushVersion = useRef(0);
  const pushCola = useRef(Promise.resolve());

  useEffect(() => {
    let activo = true;

    if (!idUsuario) return undefined;

    const cantidadCambiosInicial = preferenciasCambios.current;

    leerPreferenciasNotificaciones(idUsuario)
      .then((leidas) => {
        if (!activo) return;

        const locales = Object.fromEntries(preferenciasLocales.current);
        setPreferencias(
          preferenciasCambios.current === cantidadCambiosInicial
            ? leidas
            : {
                ...leidas,
                tiposNotificacion: { ...(leidas?.tiposNotificacion ?? {}), ...locales },
              }
        );
      })
      .catch((error) => {
        console.error('[notificaciones] no se pudieron leer las preferencias', error);
      });

    return () => {
      activo = false;
    };
  }, [idUsuario]);

  useEffect(() => {
    let activo = true;
    const versionPushInicial = pushVersion.current;

    if (!idUsuario) return () => { activo = false; };

    const consultarCuandoLaSesionEsteLista = async () => {
      // El usuario puede venir primero del caché de sesión y Firebase resolver
      // AUTH.currentUser unos milisegundos después. Evita una consulta 401 que
      // deje el ajuste visualmente deshabilitado hasta recargar.
      for (let intento = 0; intento < 20 && activo; intento += 1) {
        if (AUTH?.currentUser?.uid === idUsuario) break;
        await new Promise((resolve) => window.setTimeout(resolve, 250));
      }

      if (!activo) return;

      try {
        const estado = await consultarEstadoWebPush();
        if (activo && pushVersion.current === versionPushInicial) {
          setEstadoPush({ ...estado, cargando: false });
        }
      } catch (error) {
        console.warn('[push] no se pudo consultar el dispositivo', error);
        if (activo && pushVersion.current === versionPushInicial) {
          setEstadoPush((actual) => ({
            ...actual,
            cargando: false,
            compatible:
              typeof window !== 'undefined' &&
              'Notification' in window &&
              'serviceWorker' in navigator &&
              'PushManager' in window,
            permiso: typeof Notification !== 'undefined' ? Notification.permission : 'unsupported',
          }));
        }
      }
    };

    consultarCuandoLaSesionEsteLista();
    return () => { activo = false; };
  }, [idUsuario]);

  const cambiarPush = (habilitadas) => {
    const version = ++pushVersion.current;
    const anterior = estadoPush.habilitadas;
    setEstadoPush((estado) => ({ ...estado, cargando: false, habilitadas }));

    const guardado = pushCola.current.catch(() => {}).then(async () => {
      if (habilitadas) await activarWebPush();
      else await desactivarWebPush();
    });
    pushCola.current = guardado;

    guardado
      .then(() => {
        if (version !== pushVersion.current) return;
        setEstadoPush((estado) => ({
          ...estado,
          permiso: Notification.permission,
          habilitadas,
        }));
      })
      .catch((error) => {
        if (version !== pushVersion.current) return;
        toast.error(error.message || 'No se pudo actualizar la configuración del dispositivo.');
        setEstadoPush((estado) => ({
          ...estado,
          permiso: Notification.permission,
          habilitadas: anterior,
        }));
      });
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

  const cambiar = (tipoNotificacion, activo) => {
    const anterior = estaActivo(preferencias ?? {}, tipoNotificacion);
    preferenciasCambios.current += 1;
    const version = (preferenciasVersion.current.get(tipoNotificacion) ?? 0) + 1;
    preferenciasVersion.current.set(tipoNotificacion, version);
    preferenciasLocales.current.set(tipoNotificacion, activo);

    // Se ve al momento; si no se guarda, vuelve atrás.
    setPreferencias((actual) => ({
      ...(actual ?? {}),
      tiposNotificacion: { ...(actual?.tiposNotificacion ?? {}), [tipoNotificacion]: activo },
    }));

    const guardadoAnterior = preferenciasCola.current.get(tipoNotificacion) ?? Promise.resolve();
    const guardado = guardadoAnterior.catch(() => {}).then(() =>
      guardarPreferenciaDestinatarioNotificacion({
        idUsuario,
        rol,
        tipoNotificacion,
        activo,
        usuario: user,
      })
    );
    preferenciasCola.current.set(tipoNotificacion, guardado);

    guardado.catch((error) => {
      console.error('[notificaciones] no se pudo guardar la preferencia', error);
      if (preferenciasVersion.current.get(tipoNotificacion) !== version) return;

      preferenciasLocales.current.set(tipoNotificacion, anterior);
      setPreferencias((actual) => ({
        ...(actual ?? {}),
        tiposNotificacion: {
          ...(actual?.tiposNotificacion ?? {}),
          [tipoNotificacion]: anterior,
        },
      }));
      toast.error('No se pudo guardar el cambio.');
    }).finally(() => {
      if (preferenciasCola.current.get(tipoNotificacion) === guardado) {
        preferenciasCola.current.delete(tipoNotificacion);
      }
    });
  };

  return (
    <Card
      sx={[
        { p: 3, gap: 3, display: 'flex', flexDirection: 'column' },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
      {...other}
    >
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 4 }}>
          <ListItemText
            primary="Notificaciones en este dispositivo"
            secondary="Recibe avisos del sistema en este dispositivo."
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
              borderRadius: 2,
              display: 'flex',
              justifyContent: 'space-between',
              bgcolor: 'background.neutral',
            }}
          >
            <FormControlLabel
              label="Notificaciones push"
              labelPlacement="start"
              control={
                <Switch
                  checked={estadoPush.habilitadas}
                  disabled={
                    (!estadoPush.cargando && !estadoPush.compatible) ||
                    estadoPush.permiso === 'denied'
                  }
                  onChange={(evento) => cambiarPush(evento.target.checked)}
                  slotProps={{ input: { 'aria-label': 'Notificaciones push' } }}
                />
              }
              sx={{ m: 0, width: 1, justifyContent: 'space-between' }}
            />
          </Box>
        </Grid>
      </Grid>

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
                      disabled={!idUsuario}
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
