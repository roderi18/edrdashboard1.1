import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

// Un triángulo de advertencia arriba a la derecha de la foto, con el porqué en
// el tip. Lo usa la lista de destacamentos para marcar los que no tienen la
// información completa (ver `destacamento-info-completa.mjs`), en la vista de
// lista y en la de cuadrícula. Sin `texto` no pinta nada.
export function AvisoSobreFoto({ texto, size = 20 }) {
  if (!texto) return null;

  return (
    <Tooltip arrow title={texto}>
      <Box
        component="span"
        role="img"
        aria-label={texto}
        sx={(theme) => ({
          top: -size / 3,
          right: -size / 3,
          zIndex: 1,
          width: size,
          height: size,
          display: 'flex',
          cursor: 'help',
          alignItems: 'center',
          position: 'absolute',
          borderRadius: '50%',
          justifyContent: 'center',
          color: 'warning.main',
          bgcolor: 'background.paper',
          boxShadow: theme.vars.customShadows?.z1,
        })}
      >
        <Iconify icon="solar:danger-triangle-bold" width={size * 0.75} />
      </Box>
    </Tooltip>
  );
}
