'use client';

import { useRef, useEffect } from 'react';

import Box from '@mui/material/Box';
import Tabs from '@mui/material/Tabs';

export function OrganizationalTabs({ children, value, sx, ...other }) {
  const wrapperRef = useRef(null);

  useEffect(() => {
    if (!window.matchMedia('(max-width: 599px)').matches) return;

    const selectedTab = wrapperRef.current?.querySelector('[aria-selected="true"]');

    selectedTab?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [value]);

  return (
    <Box
      ref={wrapperRef}
      // Sin línea gris debajo, como las pestañas de la ficha del destacamento.
      sx={Array.isArray(sx) ? sx : [sx]}
    >
      <Tabs
        value={value}
        variant="scrollable"
        scrollButtons={false}
        allowScrollButtonsMobile
        sx={{
          '& .MuiTabs-indicator': { height: 2 },
          '& .MuiTabs-flexContainer': { minWidth: 'max-content' },
        }}
        {...other}
      >
        {children}
      </Tabs>
    </Box>
  );
}
