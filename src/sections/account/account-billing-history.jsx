import dynamic from 'next/dynamic';
import { useBoolean } from 'minimal-shared/hooks';

import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Card from '@mui/material/Card';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import CardHeader from '@mui/material/CardHeader';
import Typography from '@mui/material/Typography';
import ListItemText from '@mui/material/ListItemText';

import { fDate } from 'src/utils/format-time';
import { fDopCurrency } from 'src/utils/format-number';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

const InvoicePDFDownload = dynamic(
  () => import('src/sections/invoice/invoice-pdf').then((mod) => mod.InvoicePDFDownload),
  { ssr: false }
);

export function AccountBillingHistory({ invoices, sx, ...other }) {
  const showMore = useBoolean();
  const visibleInvoices = showMore.value ? invoices : invoices.slice(0, 8);

  return (
    <Card sx={sx} {...other}>
      <CardHeader title="Historial de recibos" />

      <Box
        sx={{
          px: 3,
          pt: 3,
          gap: 1.5,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {visibleInvoices.map((invoice) => (
          <Box key={invoice.id} sx={{ display: 'flex', alignItems: 'center' }}>
            <ListItemText
              primary={invoice.invoiceNumber}
              secondary={fDate(invoice.createDate || invoice.createdAt)}
              slotProps={{
                primary: { sx: { typography: 'body2' } },
                secondary: {
                  sx: { mt: 0.5, typography: 'caption', color: 'text.disabled' },
                },
              }}
            />

            <Typography variant="body2" sx={{ mr: 5 }}>
              {fDopCurrency(invoice.totalAmount ?? invoice.price)}
            </Typography>

            <InvoicePDFDownload
              invoice={invoice}
              fileName={`${invoice.invoiceNumber}.pdf`}
              renderButton={() => (
                <Link color="inherit" underline="always" variant="body2" component="span">
                  PDF
                </Link>
              )}
            />
          </Box>
        ))}

        {!visibleInvoices.length && (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            No hay recibos de compras para este perfil.
          </Typography>
        )}

        <Divider sx={{ borderStyle: 'dashed' }} />
      </Box>

      {visibleInvoices.length > 0 && invoices.length > 8 && (
        <Box sx={{ p: 2 }}>
          <Button
            size="small"
            color="inherit"
            startIcon={
              <Iconify
                width={16}
                icon={showMore.value ? 'eva:arrow-ios-upward-fill' : 'eva:arrow-ios-downward-fill'}
                sx={{ mr: -0.5 }}
              />
            }
            onClick={showMore.onToggle}
          >
            Ver {showMore.value ? 'menos' : 'mas'}
          </Button>
        </Box>
      )}
    </Card>
  );
}
