import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import CardHeader from '@mui/material/CardHeader';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

export function CheckoutBillingInfo({ checkoutState, onChangeStep, loading, sx, ...other }) {
  const { billing } = checkoutState;

  // La dirección en esqueleto, no una barra de progreso.
  const renderLoading = () => (
    <Box sx={{ height: 104 }}>
      <Skeleton variant="text" width="40%" />
      <Skeleton variant="text" width="80%" />
      <Skeleton variant="text" width="30%" />
    </Box>
  );

  return (
    <Card sx={[{ mb: 3 }, ...(Array.isArray(sx) ? sx : [sx])]} {...other}>
      <CardHeader
        title="Direccion"
        action={
          <Button
            size="small"
            startIcon={<Iconify icon="solar:pen-bold" />}
            onClick={() => onChangeStep('back')}
          >
            Editar
          </Button>
        }
      />

      <Stack spacing={1} sx={{ p: 3 }}>
        {loading ? (
          renderLoading()
        ) : (
          <>
            <Box sx={{ typography: 'subtitle2' }}>
              {`${billing?.name} `}
              <Box component="span" sx={{ color: 'text.secondary', typography: 'body2' }}>
                ({billing?.addressType})
              </Box>
            </Box>

            <Box sx={{ color: 'text.secondary', typography: 'body2' }}>{billing?.fullAddress}</Box>
            <Box sx={{ color: 'text.secondary', typography: 'body2' }}>{billing?.phoneNumber}</Box>
          </>
        )}
      </Stack>
    </Card>
  );
}
