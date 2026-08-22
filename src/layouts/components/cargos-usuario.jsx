'use client';

import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import { etiquetaDeCargo, useCargosDelUsuario } from 'src/hooks/use-cargos-del-usuario';

import { useAuthContext } from 'src/auth/hooks';

// ----------------------------------------------------------------------
// Los cargos de quien esta dentro, en la barra de arriba.
//
// Se listan TODOS: una persona puede ser Coordinador Asistente en su
// destacamento y Sub Coordinador en su seccion, y ejerce los dos. En pantallas
// estrechas se ocultan, que ahi no cabe ni el nombre.
// ----------------------------------------------------------------------

export function CargosUsuario({ sx, ...other }) {
  const { user } = useAuthContext();
  const cargos = useCargosDelUsuario(user);

  if (!cargos.length) return null;

  return (
    <Box
      sx={[
        {
          mr: 1,
          minWidth: 0,
          display: { xs: 'none', md: 'block' },
          textAlign: 'right',
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
      {...other}
    >
      {cargos.map((cargo) => {
        const etiqueta = etiquetaDeCargo(cargo);

        return (
          <Tooltip key={`${cargo.idPosicion}-${cargo.idEntidad}`} title={etiqueta} placement="left">
            <Typography
              noWrap
              variant="caption"
              sx={{ display: 'block', lineHeight: 1.4, color: 'text.secondary' }}
            >
              {etiqueta}
            </Typography>
          </Tooltip>
        );
      })}
    </Box>
  );
}
