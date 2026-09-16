'use client';

import { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';

import { isAdminGlobal } from 'src/utils/org-level-access';
import {
  AVISOS,
  SONIDOS,
  SIN_SONIDO,
  sonarAviso,
  sonidoPorClave,
  reproducirSonido,
  eleccionPorDefecto,
  fijarEleccionDeSonidos,
} from 'src/utils/sonidos-de-aviso.mjs';

import {
  guardarCopiaLocal,
  obtenerSonidosDeAviso,
  guardarSonidosDeAviso,
} from 'src/services/sonidos-service';

import { Label } from 'src/components/label';
import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';

import { useAuthContext } from 'src/auth/hooks';

// ----------------------------------------------------------------------
// COMO SUENA LA APLICACION.
//
// Cada aviso —mensaje de chat recibido, campana, mensaje enviado, archivo
// cargado— tiene aqui su sonido, y ES el que va a sonar de verdad en ese modulo:
// lo que se elige en esta pantalla se guarda para toda la organizacion.
//
// Los sonidos se generan en el navegador (ver `sonidos-de-aviso.mjs`): son tonos
// de menos de medio segundo, no archivos. Por eso suenan al instante al
// pulsarlos y se pueden comparar uno detras de otro.
//
// Pulsar un sonido lo SUENA y lo deja elegido, que es como se elige un sonido:
// oyendolo. Guardar es un boton aparte, para poder probar sin cambiarle el aviso
// a todo el mundo en cada clic.
// ----------------------------------------------------------------------

export function AdminSonidosView() {
  const { user } = useAuthContext();
  const puedeGuardar = isAdminGlobal(user);

  const [eleccion, setEleccion] = useState(eleccionPorDefecto);
  const [guardada, setGuardada] = useState(eleccionPorDefecto);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [ultimoTocado, setUltimoTocado] = useState('');

  useEffect(() => {
    let cancelado = false;

    obtenerSonidosDeAviso()
      .then((actual) => {
        if (cancelado) return;

        setEleccion(actual);
        setGuardada(actual);
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });

    return () => {
      cancelado = true;
    };
  }, []);

  const elegir = useCallback((aviso, sonido) => {
    setEleccion((actual) => ({ ...actual, [aviso]: sonido }));

    if (sonido !== SIN_SONIDO) {
      reproducirSonido(sonido);
      setUltimoTocado(`${aviso}-${sonido}`);
    }
  }, []);

  const guardar = useCallback(async () => {
    setGuardando(true);

    try {
      const limpia = await guardarSonidosDeAviso(eleccion, user);

      setGuardada(limpia);
      // Que suene ya en esta pestaña, sin recargar.
      fijarEleccionDeSonidos(limpia);
      guardarCopiaLocal(limpia);
      toast.success('Los sonidos quedaron guardados para toda la organización.');
    } catch (error) {
      toast.error(error?.message || 'No se pudieron guardar los sonidos.');
    } finally {
      setGuardando(false);
    }
  }, [eleccion, user]);

  const sinGuardar = AVISOS.some((aviso) => eleccion[aviso.clave] !== guardada[aviso.clave]);

  const renderSonido = (aviso, sonido) => {
    const elegido = eleccion[aviso.clave] === sonido.clave;

    return (
      <Button
        key={sonido.clave}
        size="small"
        variant={elegido ? 'contained' : 'outlined'}
        color={elegido ? 'primary' : 'inherit'}
        onClick={() => elegir(aviso.clave, sonido.clave)}
        startIcon={
          <Iconify
            width={16}
            icon={
              ultimoTocado === `${aviso.clave}-${sonido.clave}`
                ? 'solar:volume-loud-bold'
                : 'solar:play-circle-bold'
            }
          />
        }
      >
        {sonido.nombre}
      </Button>
    );
  };

  return (
    <Stack spacing={3}>
      <Stack spacing={1}>
        <Typography variant="h5">Sonidos de aviso</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Pulsa un sonido para oírlo; queda elegido para ese aviso. Al guardar, es el que suena en
          ese módulo para toda la organización.
        </Typography>
      </Stack>

      {!puedeGuardar && (
        <Alert severity="info">
          Puedes escuchar los sonidos, pero solo el Administrador Global cambia los de la
          organización.
        </Alert>
      )}

      {AVISOS.map((aviso) => {
        const elegido = eleccion[aviso.clave];
        const nombreElegido = sonidoPorClave(elegido)?.nombre ?? 'Sin sonido';
        const cambiado = elegido !== guardada[aviso.clave];

        return (
          <Card key={aviso.clave} sx={{ p: 2.5 }}>
            <Stack
              direction="row"
              alignItems="center"
              spacing={1.5}
              sx={{ mb: 0.5, flexWrap: 'wrap' }}
            >
              <Typography variant="subtitle1">{aviso.nombre}</Typography>
              <Label color={elegido === SIN_SONIDO ? 'default' : 'success'}>{nombreElegido}</Label>
              {cambiado && <Label color="warning">Sin guardar</Label>}
            </Stack>

            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>
              {aviso.descripcion}
            </Typography>

            <Typography variant="caption" sx={{ color: 'text.disabled', mb: 2, display: 'block' }}>
              Suena en: {aviso.modulo}
            </Typography>

            <Box sx={{ gap: 1, display: 'flex', flexWrap: 'wrap' }}>
              {SONIDOS.map((sonido) => renderSonido(aviso, sonido))}

              <Button
                size="small"
                variant={elegido === SIN_SONIDO ? 'contained' : 'outlined'}
                color={elegido === SIN_SONIDO ? 'primary' : 'inherit'}
                onClick={() => elegir(aviso.clave, SIN_SONIDO)}
                startIcon={<Iconify width={16} icon="solar:bell-off-bold" />}
              >
                Sin sonido
              </Button>
            </Box>
          </Card>
        );
      })}

      <Stack direction="row" alignItems="center" spacing={2} sx={{ flexWrap: 'wrap' }}>
        <Button
          variant="contained"
          disabled={!puedeGuardar || !sinGuardar || cargando}
          loading={guardando}
          onClick={guardar}
          startIcon={<Iconify icon="solar:check-circle-bold" />}
        >
          Guardar
        </Button>

        <Button
          color="inherit"
          disabled={!sinGuardar}
          onClick={() => setEleccion(guardada)}
          startIcon={<Iconify icon="solar:restart-bold" />}
        >
          Descartar cambios
        </Button>

        {/* Prueba lo GUARDADO, no lo que se esta mirando: es la forma de oir lo
            que oye ahora mismo el resto de la gente. */}
        <Button
          color="inherit"
          onClick={() => {
            fijarEleccionDeSonidos(guardada);
            AVISOS.forEach((aviso, indice) =>
              setTimeout(() => sonarAviso(aviso.clave), indice * 900)
            );
          }}
          startIcon={<Iconify icon="solar:play-circle-bold" />}
        >
          Probar lo guardado
        </Button>
      </Stack>
    </Stack>
  );
}
