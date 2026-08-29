'use client';

import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';

// ----------------------------------------------------------------------

// Cuanto hace, en palabras. La hora exacta no aporta: lo que se decide mirando
// esto es si vale la pena recuperarlo.
const haceCuanto = (fecha) => {
  const minutos = Math.round((Date.now() - Number(fecha || 0)) / 60000);

  if (minutos < 1) return 'hace un momento';
  if (minutos < 60) return `hace ${minutos} ${minutos === 1 ? 'minuto' : 'minutos'}`;

  const horas = Math.round(minutos / 60);

  if (horas < 24) return `hace ${horas} ${horas === 1 ? 'hora' : 'horas'}`;

  const dias = Math.round(horas / 24);

  return `hace ${dias} ${dias === 1 ? 'día' : 'días'}`;
};

/**
 * "Dejaste esto a medias." Se ofrece, no se aplica solo: recuperar un borrador
 * viejo por encima de lo que trae el servidor cambia la ficha sin que nadie lo
 * haya pedido.
 */
export function FormDraftNotice({ borrador, onRecuperar, onDescartar }) {
  if (!borrador) return null;

  return (
    <Alert
      severity="info"
      variant="outlined"
      sx={{ mb: 3, alignItems: 'center' }}
      action={
        <Stack direction="row" spacing={1}>
          <Button size="small" color="inherit" onClick={onDescartar}>
            Descartar
          </Button>
          <Button size="small" variant="contained" onClick={onRecuperar}>
            Recuperar
          </Button>
        </Stack>
      }
    >
      Tienes cambios sin guardar de {haceCuanto(borrador.fecha)}.
    </Alert>
  );
}
