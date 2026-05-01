import Box from '@mui/material/Box';

import { fDopCurrency } from 'src/utils/format-number';

// ----------------------------------------------------------------------

export function InvoiceTotalSummary({
  sx,
  taxes,
  shipping,
  subtotal,
  discount,
  totalAmount,
  ...other
}) {
  const rowStyles = {
    display: 'flex',
    alignItems: 'center',
  };

  const labelStyles = {
    color: 'text.secondary',
  };

  const valueStyles = {
    width: 160,
  };

  return (
    <Box
      sx={[
        {
          mt: 3,
          gap: 2,
          display: 'flex',
          textAlign: 'right',
          typography: 'body2',
          alignItems: 'flex-end',
          flexDirection: 'column',
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
      {...other}
    >
      <Box sx={rowStyles}>
        <Box component="span" sx={labelStyles}>
          Subtotal
        </Box>
        <Box component="span" sx={[valueStyles, { fontWeight: 'fontWeightSemiBold' }]}>
          {fDopCurrency(subtotal) || '-'}
        </Box>
      </Box>

      <Box sx={rowStyles}>
        <Box component="span" sx={labelStyles}>
          Envío
        </Box>
        <Box component="span" sx={[{ ...valueStyles }, !!shipping && { color: 'error.main' }]}>
          {shipping ? `- ${fDopCurrency(shipping)}` : '-'}
        </Box>
      </Box>

      <Box sx={rowStyles}>
        <Box component="span" sx={labelStyles}>
          Descuento
        </Box>

        <Box component="span" sx={[{ ...valueStyles }, !!discount && { color: 'error.main' }]}>
          {discount ? `- ${fDopCurrency(discount)}` : '-'}
        </Box>
      </Box>

      <Box sx={rowStyles}>
        <Box component="span" sx={labelStyles}>
          Impuestos
        </Box>
        <Box component="span" sx={valueStyles}>
          {taxes ? fDopCurrency(taxes) : '-'}
        </Box>
      </Box>

      <Box sx={[rowStyles, { typography: 'subtitle1' }]}>
        <Box component="span">Total</Box>
        <Box component="span" sx={valueStyles}>
          {fDopCurrency(totalAmount) || '-'}
        </Box>
      </Box>
    </Box>
  );
}
