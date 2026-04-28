'use client';

import Box from '@mui/material/Box';

import { useCheckoutContext } from 'src/sections/checkout/context';

// ----------------------------------------------------------------------

export function CheckoutCartNavInfo() {
  const { state } = useCheckoutContext();

  const totalItems = state.items.reduce((total, item) => total + Number(item.quantity || 0), 0);

  if (!totalItems) {
    return null;
  }

  return (
    <Box
      component="span"
      aria-label={`${totalItems} articulos en el carrito`}
      sx={{
        minWidth: 20,
        height: 20,
        px: 0.5,
        borderRadius: 10,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'common.white',
        bgcolor: 'error.main',
        typography: 'caption',
        fontWeight: 'fontWeightBold',
        lineHeight: 1,
      }}
    >
      {totalItems > 99 ? '99+' : totalItems}
    </Box>
  );
}
