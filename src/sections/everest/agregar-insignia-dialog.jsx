'use client';

import { useMemo, useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Checkbox from '@mui/material/Checkbox';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import FormControlLabel from '@mui/material/FormControlLabel';

import {
  TIPOS_INSIGNIA,
  llevaNumeroDorado,
  validarInsigniaNueva,
  validarInsigniaEditada,
  MAXIMO_NOMBRE_INSIGNIA,
  MAXIMO_DESCRIPCION_INSIGNIA,
} from 'src/utils/insignias-personalizadas.mjs';

import {
  editarInsignia,
  crearInsigniaPersonalizada,
} from 'src/services/insignias-personalizadas-service';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { ImagenDePin, ImagenDeCinta, ImagenDeMedalla } from 'src/components/insignias-perfil';

import { useAuthContext } from 'src/auth/hooks';

// ----------------------------------------------------------------------
// AGREGAR UNA CINTA, UNA MEDALLA O UN PIN desde EXPLORA Designer: imagen, nombre
// y descripción, las tres obligatorias.
//
// Con `insignia` es EDITAR (también las de fábrica): parte de su nombre, su
// descripción y su imagen, y la imagen nueva es opcional.
//
// La vista previa se pinta con la MISMA pieza del perfil y con el ancho de una
// casilla de la rejilla (`ANCHO_DE_CASILLA`), para ver antes de guardar cómo va a
// quedar al lado de las demás: una imagen con otras proporciones se nota aquí y
// no después en todos los perfiles.
// ----------------------------------------------------------------------

export const ANCHO_DE_CASILLA = {
  [TIPOS_INSIGNIA.CINTA]: 180,
  [TIPOS_INSIGNIA.MEDALLA]: 130,
  [TIPOS_INSIGNIA.PIN]: 160,
};

const TEXTOS = {
  [TIPOS_INSIGNIA.CINTA]: {
    titulo: 'Agregar cinta',
    editar: 'Editar cinta',
    guardada: 'Cinta agregada.',
    editada: 'Cinta actualizada.',
  },
  [TIPOS_INSIGNIA.MEDALLA]: {
    titulo: 'Agregar medalla',
    editar: 'Editar medalla',
    guardada: 'Medalla agregada.',
    editada: 'Medalla actualizada.',
  },
  [TIPOS_INSIGNIA.PIN]: {
    titulo: 'Agregar pin',
    editar: 'Editar pin',
    guardada: 'Pin agregado.',
    editada: 'Pin actualizado.',
  },
};

export function AgregarInsigniaDialog({ tipo, open, onClose, insignia: editando = null }) {
  const { user } = useAuthContext();
  const [archivo, setArchivo] = useState(null);
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  // El número dorado de "veces ganada" (cintas y medallas; los pines no lo tienen).
  const conNumero = tipo === TIPOS_INSIGNIA.CINTA || tipo === TIPOS_INSIGNIA.MEDALLA;
  const [llevaNumero, setLlevaNumero] = useState(tipo === TIPOS_INSIGNIA.CINTA);
  const [guardando, setGuardando] = useState(false);
  const [intentado, setIntentado] = useState(false);

  const vistaPrevia = useMemo(() => (archivo ? URL.createObjectURL(archivo) : ''), [archivo]);

  useEffect(
    () => () => {
      if (vistaPrevia) URL.revokeObjectURL(vistaPrevia);
    },
    [vistaPrevia]
  );

  // Al abrir para editar parte de lo que tiene; al cerrar se empieza de cero.
  useEffect(() => {
    if (open) {
      setNombre(editando?.nombre ?? '');
      setDescripcion(editando?.descripcion ?? '');
      setLlevaNumero(llevaNumeroDorado(editando || {}, tipo));
      return;
    }

    setArchivo(null);
    setNombre('');
    setDescripcion('');
    setIntentado(false);
  }, [open, editando, tipo]);

  const error = editando
    ? validarInsigniaEditada({ nombre, descripcion })
    : validarInsigniaNueva({ tipo, nombre, descripcion, tieneImagen: Boolean(archivo) });
  // Sin imagen nueva, la vista previa enseña la que ya tiene.
  const imagenMostrada = vistaPrevia || editando?.src || '';
  const insignia = { id: 'nueva', nombre: nombre || 'Nueva', descripcion, src: imagenMostrada };

  const guardar = async () => {
    setIntentado(true);

    if (error) return;

    setGuardando(true);

    try {
      if (editando) {
        await editarInsignia({
          tipo,
          insignia: editando,
          archivo,
          nombre,
          descripcion,
          ...(conNumero ? { llevaNumero } : {}),
          usuario: user,
        });
        toast.success(TEXTOS[tipo].editada);
      } else {
        await crearInsigniaPersonalizada({
          tipo,
          archivo,
          nombre,
          descripcion,
          ...(conNumero ? { llevaNumero } : {}),
          usuario: user,
        });
        toast.success(TEXTOS[tipo].guardada);
      }
      onClose();
    } catch (fallo) {
      console.error('[insignias] no se pudo guardar', fallo);
      toast.error(fallo?.message || 'No se pudo guardar.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog open={open} fullWidth maxWidth="xs" onClose={guardando ? undefined : onClose}>
      <DialogTitle>{editando ? TEXTOS[tipo].editar : TEXTOS[tipo].titulo}</DialogTitle>

      <DialogContent>
        <Stack spacing={2.5} sx={{ pt: 1 }}>
          <Stack alignItems="center" spacing={1.5}>
            <Box
              sx={{
                p: 1,
                width: ANCHO_DE_CASILLA[tipo],
                minHeight: { cinta: 60, medalla: 160, pin: 110 }[tipo],
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 1,
                border: (theme) =>
                  `1px dashed ${
                    intentado && !imagenMostrada
                      ? theme.vars.palette.error.main
                      : theme.vars.palette.divider
                  }`,
              }}
            >
              {imagenMostrada ? (
                <Box sx={{ width: 1 }}>
                  {tipo === TIPOS_INSIGNIA.CINTA ? (
                    <ImagenDeCinta cinta={insignia} veces={1} />
                  ) : tipo === TIPOS_INSIGNIA.PIN ? (
                    <ImagenDePin pin={insignia} />
                  ) : (
                    <ImagenDeMedalla medalla={{ ...insignia, srcPequena: imagenMostrada }} />
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
              {archivo || editando ? 'Cambiar imagen' : 'Elegir imagen'}
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
            error={intentado && !editando && !descripcion.trim()}
            helperText="Sale al pasar el ratón por encima, en el perfil y al asignarla."
            slotProps={{ htmlInput: { maxLength: MAXIMO_DESCRIPCION_INSIGNIA } }}
          />

          {conNumero && (
            <FormControlLabel
              control={
                <Checkbox
                  checked={llevaNumero}
                  disabled={guardando}
                  onChange={(evento) => setLlevaNumero(evento.target.checked)}
                />
              }
              label="Lleva número (veces ganada)"
              slotProps={{ typography: { variant: 'body2' } }}
            />
          )}

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
          {editando ? 'Guardar' : 'Agregar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
