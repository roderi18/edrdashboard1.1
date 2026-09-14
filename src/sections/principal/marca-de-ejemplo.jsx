import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------
// LA MARCA QUE DICE "ESTO NO ES REAL".
//
// Varios paneles de la pantalla Principal enseñan cifras verosimiles que no
// salen de ningun sitio: no hay servicio de eventos, ni de comunicados, ni de
// progreso. Sin una marca visible, un panel asi se lee como el estado real de la
// organizacion y alguien acabaria tomando una decision con datos que nadie midio.
//
// Va discreta pero SIEMPRE a la vista —no escondida detras de un `title`—, y
// explica al pasar el raton de donde saldra el dato cuando exista.
//
// Cuando un panel se conecte, se le quita esta marca. Cuando se conecten todos,
// este archivo y `datos-de-ejemplo.js` se borran juntos.
// ----------------------------------------------------------------------

export function MarcaDeEjemplo({ sobreOscuro = false, sx }) {
  return (
    <Tooltip title="Datos de ejemplo: este panel aún no está conectado a ningún servicio.">
      <Box
        sx={[
          {
            px: 0.75,
            py: 0.25,
            gap: 0.5,
            display: 'inline-flex',
            alignItems: 'center',
            borderRadius: 0.75,
            typography: 'caption',
            fontWeight: 600,
            cursor: 'default',
            ...(sobreOscuro
              ? { color: 'rgba(255,255,255,.82)', bgcolor: 'rgba(255,255,255,.14)' }
              : { color: 'text.secondary', bgcolor: 'background.neutral' }),
          },
          ...(Array.isArray(sx) ? sx : [sx]),
        ]}
      >
        <Iconify icon="solar:info-circle-bold" width={14} />
        Ejemplo
      </Box>
    </Tooltip>
  );
}
