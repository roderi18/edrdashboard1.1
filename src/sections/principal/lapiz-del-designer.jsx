import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------
// EL LAPIZ DE CADA TARJETA DE LA PORTADA (EVEREST, fase 6).
//
// Lleva al Designer con ese bloque abierto y un "Volver" a la portada. Sustituye
// al lapiz de imagen de antes, que subia la foto y la cambiaba para toda la
// organizacion en el acto, sin vista previa ni Historial: ahora cambiar el fondo
// es un borrador mas, que se ve antes de publicarlo.
//
// Solo lo ve el Administrador Global (quien pinta la tarjeta decide si lo pone).
// ----------------------------------------------------------------------

export const enlaceAlDesigner = (idBloque) =>
  `${paths.dashboard.everest}?bloque=${encodeURIComponent(idBloque)}&volver=${encodeURIComponent(paths.dashboard.principal)}`;

export function LapizDelDesigner({ idBloque, sobreOscuro = false, sx }) {
  return (
    <Tooltip title="Editar en EVEREST Designer">
      <IconButton
        component={RouterLink}
        href={enlaceAlDesigner(idBloque)}
        size="small"
        aria-label="Editar en EVEREST Designer"
        sx={[
          sobreOscuro
            ? {
                color: '#FFFFFF',
                bgcolor: 'rgba(255, 255, 255, 0.12)',
                '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.22)' },
              }
            : { color: 'text.secondary' },
          ...(Array.isArray(sx) ? sx : [sx]),
        ]}
      >
        <Iconify icon="solar:pen-bold" width={16} />
      </IconButton>
    </Tooltip>
  );
}
