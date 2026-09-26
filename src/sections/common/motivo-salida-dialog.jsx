'use client';

import { useState, useEffect } from 'react';

import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import { MOTIVOS_SALIDA } from 'src/utils/directiva-historial.mjs';

// ----------------------------------------------------------------------
// PRECISAR EL MOTIVO DE UNA SALIDA. Al salir solo se sabe si a la persona la
// reemplazaron o si la casilla quedó vacía; aquí el Administrador Global o la
// Oficina Nacional dicen si fue renuncia, fallecimiento, fin de cuatrienio...
// Responde al pulsar: el diálogo se cierra y la lista se relee sola.
// ----------------------------------------------------------------------

export function MotivoSalidaDialog({ salida, onClose, onGuardar }) {
  const [motivo, setMotivo] = useState('sin_especificar');
  const [nota, setNota] = useState('');

  useEffect(() => {
    if (!salida) return;

    setMotivo(salida.motivo || 'sin_especificar');
    setNota(salida.motivoNota || '');
  }, [salida]);

  return (
    <Dialog fullWidth maxWidth="xs" open={Boolean(salida)} onClose={onClose}>
      <DialogTitle>Motivo de salida</DialogTitle>

      <DialogContent sx={{ display: 'grid', gap: 2, pt: '8px !important' }}>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {salida?.nombreMiembro} · {salida?.cargoNombre}
        </Typography>

        <TextField
          select
          label="Motivo"
          value={motivo}
          onChange={(event) => setMotivo(event.target.value)}
        >
          {MOTIVOS_SALIDA.map((opcion) => (
            <MenuItem key={opcion.value} value={opcion.value}>
              {opcion.label}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          multiline
          minRows={2}
          label="Nota (opcional)"
          value={nota}
          onChange={(event) => setNota(event.target.value.slice(0, 300))}
          helperText={`${nota.length}/300`}
        />
      </DialogContent>

      <DialogActions>
        <Button color="inherit" onClick={onClose}>
          Cancelar
        </Button>
        <Button variant="contained" onClick={() => onGuardar({ salida, motivo, nota })}>
          Guardar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
