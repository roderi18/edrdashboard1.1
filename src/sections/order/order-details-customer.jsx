import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Avatar from '@mui/material/Avatar';
import IconButton from '@mui/material/IconButton';
import CardHeader from '@mui/material/CardHeader';
import Typography from '@mui/material/Typography';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

const ROLE_LABELS = {
  member: 'Miembro',
  admin: 'Administrador',
  user: 'Usuario',
};

export function OrderDetailsCustomer({ customer }) {
  return (
    <>
      <CardHeader
        title="Miembro"
        action={
          <IconButton>
            <Iconify icon="solar:pen-bold" />
          </IconButton>
        }
      />
      <Box sx={{ p: 3, display: 'flex' }}>
        <Avatar
          alt={customer?.name}
          src={customer?.avatarUrl}
          sx={{ width: 48, height: 48, mr: 2 }}
        />

        <Stack spacing={0.5} sx={{ typography: 'body2', alignItems: 'flex-start' }}>
          <Typography variant="subtitle2">{customer?.name}</Typography>
          {customer?.codigoMiembro && (
            <Box sx={{ color: 'text.secondary' }}>{String(customer.codigoMiembro).toUpperCase()}</Box>
          )}
          {customer?.memberRole && (
            <Box sx={{ color: 'text.secondary' }}>
              {ROLE_LABELS[String(customer.memberRole).toLowerCase()] || customer.memberRole}
            </Box>
          )}
          {(customer?.destName || customer?.sectionalName || customer?.regionalName) && (
            <Box sx={{ color: 'text.secondary' }}>
              {[customer?.destName, customer?.sectionalName, customer?.regionalName]
                .filter(Boolean)
                .join(' / ')}
            </Box>
          )}
          {customer?.phoneNumber && (
            <Box sx={{ color: 'text.secondary' }}>Telefono: {customer.phoneNumber}</Box>
          )}

          <div>
            Direccion IP:
            <Box component="span" sx={{ color: 'text.secondary', ml: 0.25 }}>
              {customer?.ipAddress}
            </Box>
          </div>

          <Button
            size="small"
            color="error"
            startIcon={<Iconify icon="mingcute:add-line" />}
            sx={{ mt: 1 }}
          >
            Agregar a lista negra
          </Button>
        </Stack>
      </Box>
    </>
  );
}
