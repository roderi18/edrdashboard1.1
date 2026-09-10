'use client';

import { useBoolean } from 'minimal-shared/hooks';
import { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';

import { isAdminGlobal } from 'src/utils/org-level-access';

import {
  obtenerEncabezadoTienda,
  guardarEncabezadoTienda,
  ENCABEZADO_TIENDA_POR_DEFECTO,
} from 'src/services/store-settings-service';

import { Logo } from 'src/components/logo';
import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';

import { useAuthContext } from 'src/auth/hooks';

// ----------------------------------------------------------------------
// LA PORTADA DE LA TIENDA.
//
// SIN FOTOGRAFIA DE FONDO: una foto obliga a elegir entre que se lea el titulo o
// que se vea la imagen, y encima pesa en el primer pintado de una pantalla que ya
// carga decenas de fotos de producto. El fondo es el degradado del propio tema,
// asi que la portada cambia de color con el modo claro y el oscuro sin tener dos
// imagenes.
//
// El titulo y el subtitulo los escribe el Administrador Global; el resto —el
// escudo y las dos etiquetas— es identidad fija de la organizacion.
// ----------------------------------------------------------------------

export function StoreHeader({ sx }) {
  const { user } = useAuthContext();
  const dialogo = useBoolean();

  const puedeEditar = isAdminGlobal(user);

  const [encabezado, setEncabezado] = useState(ENCABEZADO_TIENDA_POR_DEFECTO);
  const [borrador, setBorrador] = useState(ENCABEZADO_TIENDA_POR_DEFECTO);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    let cancelado = false;

    obtenerEncabezadoTienda().then((textos) => {
      if (!cancelado) setEncabezado(textos);
    });

    return () => {
      cancelado = true;
    };
  }, []);

  const handleAbrir = useCallback(() => {
    setBorrador(encabezado);
    dialogo.onTrue();
  }, [encabezado, dialogo]);

  const handleGuardar = useCallback(async () => {
    setGuardando(true);

    try {
      const guardado = await guardarEncabezadoTienda(borrador, user);

      setEncabezado(guardado);
      dialogo.onFalse();
      toast.success('Encabezado de la tienda actualizado.');
    } catch (error) {
      toast.error(error?.message || 'No se pudo guardar el encabezado.');
    } finally {
      setGuardando(false);
    }
  }, [borrador, user, dialogo]);

  return (
    <>
      <Card
        sx={[
          (theme) => ({
            p: { xs: 2.5, md: 4 },
            color: 'common.white',
            backgroundImage: `linear-gradient(135deg, ${theme.vars.palette.primary.darker} 0%, ${theme.vars.palette.primary.dark} 100%)`,
          }),
          ...(Array.isArray(sx) ? sx : [sx]),
        ]}
      >
        <Stack
          direction="row"
          spacing={{ xs: 2, md: 3 }}
          alignItems="center"
          sx={{ minWidth: 0 }}
        >
          <Box
            sx={{
              p: 1,
              flexShrink: 0,
              borderRadius: 2,
              display: { xs: 'none', sm: 'flex' },
              bgcolor: 'common.white',
            }}
          >
            <Logo disabled sx={{ width: 48, height: 48 }} />
          </Box>

          <Box sx={{ minWidth: 0, flexGrow: 1 }}>
            <Typography
              variant="overline"
              sx={{ display: 'block', opacity: 0.72, letterSpacing: 1.2 }}
            >
              Tienda oficial
            </Typography>

            <Typography variant="h4" sx={{ mt: 0.25 }}>
              {encabezado.titulo}
            </Typography>

            {/* El subtitulo baja de linea en el movil: al lado del titulo se
                parte en tres renglones y la portada se come media pantalla. */}
            <Typography
              variant="body2"
              sx={{ mt: 0.5, opacity: 0.8, fontStyle: 'italic' }}
            >
              {encabezado.subtitulo}
            </Typography>
          </Box>

          {puedeEditar && (
            <IconButton
              aria-label="Editar encabezado de la tienda"
              onClick={handleAbrir}
              sx={{ color: 'common.white', flexShrink: 0, alignSelf: 'flex-start' }}
            >
              <Iconify icon="solar:pen-bold" />
            </IconButton>
          )}
        </Stack>
      </Card>

      <Dialog fullWidth maxWidth="sm" open={dialogo.value} onClose={dialogo.onFalse}>
        <DialogTitle>Encabezado de la tienda</DialogTitle>

        <DialogContent dividers>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            <TextField
              fullWidth
              label="Título"
              value={borrador.titulo}
              onChange={(event) => setBorrador((actual) => ({ ...actual, titulo: event.target.value }))}
              helperText={`En blanco vuelve a "${ENCABEZADO_TIENDA_POR_DEFECTO.titulo}".`}
            />

            <TextField
              fullWidth
              label="Subtítulo"
              value={borrador.subtitulo}
              onChange={(event) =>
                setBorrador((actual) => ({ ...actual, subtitulo: event.target.value }))
              }
              helperText={`En blanco vuelve a "${ENCABEZADO_TIENDA_POR_DEFECTO.subtitulo}".`}
            />
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button color="inherit" onClick={dialogo.onFalse}>
            Cancelar
          </Button>

          <Button variant="contained" onClick={handleGuardar} loading={guardando}>
            Guardar
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
