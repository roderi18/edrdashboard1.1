'use client';

import { useMemo, useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import {
  TIPOS_INSIGNIA,
  validarInsigniaNueva,
  MAXIMO_NOMBRE_INSIGNIA,
  MAXIMO_DESCRIPCION_INSIGNIA,
} from 'src/utils/insignias-personalizadas.mjs';

import { crearInsigniaPersonalizada } from 'src/services/insignias-personalizadas-service';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { ImagenDeCinta, ImagenDeMedalla } from 'src/components/insignias-perfil';

import { useAuthContext } from 'src/auth/hooks';

// ----------------------------------------------------------------------
// AGREGAR UNA CINTA O UNA MEDALLA desde EXPLORA Designer: imagen, nombre y
// descripción, las tres obligatorias.
//
// La vista previa se pinta con la MISMA pieza del perfil y con el ancho de una
// casilla de la rejilla (`ANCHO_DE_CASILLA`), para ver antes de guardar cómo va a
// quedar al lado de las demás: una imagen con otras proporciones se nota aquí y
// no después en todos los perfiles.
// ----------------------------------------------------------------------

export const ANCHO_DE_CASILLA = { [TIPOS_INSIGNIA.CINTA]: 180, [TIPOS_INSIGNIA.MEDALLA]: 130 };

const TEXTOS = {
  [TIPOS_INSIGNIA.CINTA]: { titulo: 'Agregar cinta', guardada: 'Cinta agregada.' },
  [TIPOS_INSIGNIA.MEDALLA]: { titulo: 'Agregar medalla', guardada: 'Medalla agregada.' },
};

export function AgregarInsigniaDialog({ tipo, open, onClose }) {
  const { user } = useAuthContext();
  const [archivo, setArchivo] = useState(null);
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [intentado, setIntentado] = useState(false);

  const vistaPrevia = useMemo(() => (archivo ? URL.createObjectURL(archivo) : ''), [archivo]);

  useEffect(
    () => () => {
      if (vistaPrevia) URL.revokeObjectURL(vistaPrevia);
    },
    [vistaPrevia]
  );

  // Al cerrar se empieza de cero la próxima vez.
  useEffect(() => {
    if (open) return;

    setArchivo(null);
    setNombre('');
    setDescripcion('');
    setIntentado(false);
  }, [open]);

  const error = validarInsigniaNueva({ tipo, nombre, descripcion, tieneImagen: Boolean(archivo) });
  const insignia = { id: 'nueva', nombre: nombre || 'Nueva', descripcion, src: vistaPrevia };

  const guardar = async () => {
    setIntentado(true);

    if (error) return;

    setGuardando(true);

    try {
      await crearInsigniaPersonalizada({ tipo, archivo, nombre, descripcion, usuario: user });
      toast.success(TEXTOS[tipo].guardada);
      onClose();
    } catch (fallo) {
      console.error('[insignias] no se pudo agregar', fallo);
      toast.error(fallo?.message || 'No se pudo agregar.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog open={open} fullWidth maxWidth="xs" onClose={guardando ? undefined : onClose}>
      <DialogTitle>{TEXTOS[tipo].titulo}</DialogTitle>

      <DialogContent>
        <Stack spacing={2.5} sx={{ pt: 1 }}>
          <Stack alignItems="center" spacing={1.5}>
            <Box
              sx={{
                p: 1,
                width: ANCHO_DE_CASILLA[tipo],
                minHeight: tipo === TIPOS_INSIGNIA.CINTA ? 60 : 160,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 1,
                border: (theme) =>
                  `1px dashed ${
                    intentado && !archivo
                      ? theme.vars.palette.error.main
                      : theme.vars.palette.divider
                  }`,
              }}
            >
              {vistaPrevia ? (
                <Box sx={{ width: 1 }}>
                  {tipo === TIPOS_INSIGNIA.CINTA ? (
                    <ImagenDeCinta cinta={insignia} veces={1} />
                  ) : (
                    <ImagenDeMedalla medalla={{ ...insignia, srcPequena: vistaPrevia }} />
                  )}
                </Box>
              ) : (
                <Typography variant="caption" sx={{ color: 'text.disabled', textAlign: 'center' }}>
                  Sin imagen
                </Typography>
              )}
            </Box>

            <Button
              component="label"
              size="small"
              variant="outlined"
              disabled={guardando}
              startIcon={<Iconify icon="solar:gallery-add-bold" />}
            >
              {archivo ? 'Cambiar imagen' : 'Elegir imagen'}
              <input
                hidden
                type="file"
                accept="image/png,image/webp,image/jpeg"
                onChange={(evento) => setArchivo(evento.target.files?.[0] || null)}
              />
            </Button>
          </Stack>

          <TextField
            label="Nombre"
            value={nombre}
            disabled={guardando}
            onChange={(evento) => setNombre(evento.target.value)}
            error={intentado && !nombre.trim()}
            slotProps={{ htmlInput: { maxLength: MAXIMO_NOMBRE_INSIGNIA } }}
          />

          <TextField
            multiline
            minRows={3}
            label="Descripción"
            value={descripcion}
            disabled={guardando}
            onChange={(evento) => setDescripcion(evento.target.value)}
            error={intentado && !descripcion.trim()}
            helperText="Sale al pasar el ratón por encima, en el perfil y al asignarla."
            slotProps={{ htmlInput: { maxLength: MAXIMO_DESCRIPCION_INSIGNIA } }}
          />

          {intentado && error && (
            <Typography variant="caption" sx={{ color: 'error.main' }}>
              {error}
            </Typography>
          )}
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button color="inherit" onClick={onClose} disabled={guardando}>
          Cancelar
        </Button>
        <Button variant="contained" color="primary" onClick={guardar} loading={guardando}>
          Agregar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
