'use client';

import Box from '@mui/material/Box';

import { DominicanRepublicMapDemo } from './dominican-republic-map-demo';

// ----------------------------------------------------------------------
// "DATOS DEMOGRÁFICOS" (menú, debajo de Asistencias): el mapa de destacamentos
// por provincia y región, que antes vivía en /pruebas. Ocupa lo que deja la
// cabecera del panel.

export function DatosDemograficosView() {
  return (
    <Box sx={{ width: 1 }}>
      <DominicanRepublicMapDemo
        alto={{
          xs: 'calc(100dvh - var(--layout-header-mobile-height))',
          lg: 'calc(100dvh - var(--layout-header-desktop-height))',
        }}
      />
    </Box>
  );
}
