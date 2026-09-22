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
      sx={{
        color: 'common.black',
        bgcolor: 'common.white',
        minWidth: { xs: 36, sm: 64 },
        px: { xs: 0, sm: 2 },
        '&:hover': { bgcolor: 'grey.300' },
        '& .MuiButton-startIcon': { mx: { xs: 0, sm: '-4px' } },
      }}
    >
      <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
        Crear nuevo
      </Box>
    </Button>
  );
}
