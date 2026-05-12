import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Button from '@mui/material/Button';

import { fCurrency } from 'src/utils/format-number';

// ----------------------------------------------------------------------

export function EcommerceCurrentBalance({
  sx,
  title,
  earning,
  refunded,
  orderTotal,
  currentBalance,
  ...other
}) {
  const renderRow = (label, value) => (
    <Box sx={{ display: 'flex', typography: 'body2', justifyContent: 'space-between' }}>
      <Box component="span" sx={{ color: 'text.secondary' }}>
        {label}
      </Box>

      <Box component="span">{fCurrency(value)}</Box>
    </Box>
  );

  return (
    <Card sx={[{ p: 3 }, ...(Array.isArray(sx) ? sx : [sx])]} {...other}>
      <Box sx={{ mb: 1, typography: 'subtitle2' }}>{title}</Box>

      <Box sx={{ gap: 2, display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ typography: 'h3' }}>{fCurrency(currentBalance)}</Box>

        {renderRow('Total de pedidos', orderTotal)}
        {renderRow('Ganancias', earning)}
        {renderRow('Reembolsado', refunded)}

        <Box sx={{ gap: 2, display: 'flex' }}>
          <Button fullWidth variant="contained" color="warning">
            Solicitar
          </Button>

          <Button fullWidth variant="contained" color="primary">
            Transferir
          </Button>
        </Box>
      </Box>
    </Card>
  );
}
