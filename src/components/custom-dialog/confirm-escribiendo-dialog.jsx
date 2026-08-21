import { useState, useEffect } from 'react';

import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import { ConfirmDialog } from './confirm-dialog';

// ----------------------------------------------------------------------
// Confirmacion escrita para lo que no se puede deshacer.
//
// Borrar una persona o un nivel organizacional se lleva por delante su cuenta,
// sus cargos y su historial, y no hay vuelta atras. Un boton rojo se pulsa sin
// querer; escribir la palabra, no.
//
// Se compara sin distinguir mayusculas ni espacios sobrantes: la barrera esta
// para que quien borra se detenga a leer, no para castigarle por la mayuscula.
// ----------------------------------------------------------------------

export const PALABRA_CONFIRMACION = 'Eliminar';

const coincide = (escrito, palabra) =>
  String(escrito || '').trim().toLocaleLowerCase() === String(palabra).toLocaleLowerCase();

export function ConfirmEscribiendoDialog({
  open,
  onClose,
  onConfirm,
  title = 'Eliminar',
  content,
  palabra = PALABRA_CONFIRMACION,
  confirmLabel = 'Eliminar',
}) {
  const [escrito, setEscrito] = useState('');

  // Cada vez que se abre empieza en blanco: si conservara lo escrito, la segunda
  // vez bastaria con pulsar el boton y la barrera dejaria de existir.
  useEffect(() => {
    if (open) setEscrito('');
  }, [open]);

  const confirmado = coincide(escrito, palabra);

  const confirmar = () => {
    if (!confirmado) return;

    onConfirm?.();
    onClose?.();
  };

  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      title={title}
      content={
        <>
          {content}

          <Typography variant="body2" sx={{ mt: 2, color: 'text.secondary' }}>
            Esta acción no se puede deshacer. Para continuar, escribe{' '}
            <Typography component="span" variant="subtitle2" sx={{ color: 'text.primary' }}>
              {palabra}
            </Typography>
            .
          </Typography>

          <TextField
            fullWidth
            autoFocus
            size="small"
            value={escrito}
            onChange={(evento) => setEscrito(evento.target.value)}
            onKeyDown={(evento) => {
              if (evento.key === 'Enter') confirmar();
            }}
            placeholder={palabra}
            sx={{ mt: 1.5 }}
            slotProps={{ input: { 'aria-label': `Escribe ${palabra} para confirmar` } }}
          />
        </>
      }
      action={
        <Button variant="contained" color="error" disabled={!confirmado} onClick={confirmar}>
          {confirmLabel}
        </Button>
      }
    />
  );
}
