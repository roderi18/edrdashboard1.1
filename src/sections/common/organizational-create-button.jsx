'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';

import { RouterLink } from 'src/routes/components';

import { Iconify } from 'src/components/iconify';

// La misma acción de alta en todas las listas. En pantallas pequeñas conserva
// el botón blanco y deja únicamente el signo + junto al título.
export function OrganizationalCreateButton({ href, ariaLabel = 'Crear nuevo' }) {
  return (
    <Button
      component={RouterLink}
      href={href}
      variant="contained"
      aria-label={ariaLabel}
      title={ariaLabel}
      startIcon={<Iconify icon="mingcute:add-line" />}
      // Solo en el movil va blanco y con el + solo. En pantalla grande es el
      // boton relleno de siempre: el blanco sin borde se perdia en el fondo y
      // el margen negativo pegaba el + a las letras.
      sx={(theme) => ({
        [theme.breakpoints.down('sm')]: {
          color: 'common.black',
          bgcolor: 'common.white',
          minWidth: 36,
          px: 0,
          '&:hover': { bgcolor: 'grey.300' },
          '& .MuiButton-startIcon': { mx: 0 },
        },
      })}
    >
      <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
        Crear nuevo
      </Box>
    </Button>
  );
}
