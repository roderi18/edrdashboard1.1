'use client';

import { useState } from 'react';

import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import ToggleButton from '@mui/material/ToggleButton';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

import { TIPOS_NODO, MAXIMO_NOMBRE_PREMIO } from 'src/utils/premios-personalizados.mjs';

import { crearPremioPersonalizado } from 'src/services/premios-personalizados-service';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { UploadAvatar } from 'src/components/upload';

// ----------------------------------------------------------------------
// "Agregar": un premio o una carpeta (se elige), con nombre e imagen, en la
// carpeta abierta. Solo el Administrador Global lo ve; sale para todos.
// ----------------------------------------------------------------------

export function AwardsAgregarPremioDialog({ open, onClose, carpeta, usuario, onCreado }) {
  const [tipo, setTipo] = useState(TIPOS_NODO.premio);
  const [nombre, setNombre] = useState('');
  const esCarpeta = tipo === TIPOS_NODO.carpeta;
  const [archivo, setArchivo] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const cerrar = () => {
    if (guardando) return;
    setNombre('');
    setArchivo(null);
    onClose();
  };

  const guardar = async () => {
    setGuardando(true);
    try {
      const premio = await crearPremioPersonalizado({
        tipo,
        nombre,
        idCarpeta: carpeta?.id,
        nombreCarpeta: carpeta?.name,
        archivo,
        usuario,
      });
      toast.success(`${esCarpeta ? 'Carpeta' : 'Premio'} "${premio.name}" agregado.`);
      onCreado?.(premio);
      setNombre('');
      setArchivo(null);
      onClose();
    } catch (error) {
      toast.error(error.message || 'No se pudo agregar.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog fullWidth maxWidth="xs" open={open} onClose={cerrar}>
      <DialogTitle>Agregar</DialogTitle>
      <DialogContent>
        <Stack spacing={3} sx={{ pt: 1 }}>
          <ToggleButtonGroup
            exclusive
            fullWidth
            color="primary"
            value={tipo}
            onChange={(_, v) => v && setTipo(v)}
          >
            <ToggleButton value={TIPOS_NODO.premio} sx={{ gap: 1 }}>
              <Iconify icon="solar:medal-ribbon-bold" /> Premio
            </ToggleButton>
            <ToggleButton value={TIPOS_NODO.carpeta} sx={{ gap: 1 }}>
              <Iconify icon="solar:add-folder-bold" /> Carpeta
            </ToggleButton>
          </ToggleButtonGroup>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Se agregará en <strong>{carpeta?.name}</strong> y lo verán todos los miembros.
          </Typography>
          <UploadAvatar
            value={archivo}
            onDrop={(files) => setArchivo(files?.[0] || null)}
            helperText={
              <Typography
                variant="caption"
                sx={{ mt: 2, mx: 'auto', display: 'block', textAlign: 'center', color: 'text.disabled' }}
              >
                {esCarpeta ? 'Imagen de la carpeta' : 'Imagen de la insignia'} (opcional · PNG, JPG o WEBP)
              </Typography>
            }
          />
          <TextField
            autoFocus
            label={esCarpeta ? 'Nombre de la carpeta' : 'Nombre del premio'}
            value={nombre}
            onChange={(event) => setNombre(event.target.value)}
            slotProps={{ htmlInput: { maxLength: MAXIMO_NOMBRE_PREMIO } }}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" color="inherit" onClick={cerrar} disabled={guardando}>
          Cancelar
        </Button>
        <Button
          variant="contained"
          onClick={guardar}
          loading={guardando}
          disabled={!nombre.trim()}
        >
          Agregar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
