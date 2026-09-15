import dynamic from 'next/dynamic';

import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';

import { paths } from 'src/routes/paths';
import { usePathname } from 'src/routes/hooks';
import { RouterLink } from 'src/routes/components';

import { AVISO_SOLICITUD_ENVIADA } from 'src/utils/solicitud-producto.mjs';

import { OrderCompleteIllustration } from 'src/assets/illustrations';

import { Label } from 'src/components/label';
import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

const InvoicePDFDownload = dynamic(
  () => import('../invoice/invoice-pdf').then((mod) => mod.InvoicePDFDownload),
  { ssr: false }
);

// ----------------------------------------------------------------------

export function CheckoutOrderComplete({
  receipt,
  orderId,
  orderNumber,
  onResetCart,
  evaluationInProcess = false,
  requestInProcess = false,
  slotProps,
  ...other
}) {
  const pathname = usePathname();
  const continueShoppingPath = pathname.includes(paths.dashboard.root)
    ? paths.dashboard.product.root
    : paths.product.root;
  const dialogPaperSx = slotProps?.paper?.sx;
  const receiptLabel = receipt?.invoiceNumber || orderNumber || 'Recibo local creado';
  const receiptDetailsPath = receipt?.id ? paths.dashboard.invoice.details(receipt.id) : '';
  // Una solicitud no tiene recibo: se enlaza la orden, que es donde se sigue.
  const orderDetailsPath =
    orderNumber || orderId ? paths.dashboard.order.details(orderNumber || orderId) : '';

  return (
    <Dialog
      fullWidth
      fullScreen
      slotProps={{
        ...slotProps,
        paper: {
          ...slotProps?.paper,
          sx: [
            {
              width: { md: `calc(100% - 48px)` },
              height: { md: `calc(100% - 48px)` },
            },
            ...(Array.isArray(dialogPaperSx) ? dialogPaperSx : [dialogPaperSx]),
          ],
        },
      }}
      {...other}
    >
      <Box
        sx={{
          py: 5,
          gap: 5,
          m: 'auto',
          maxWidth: 480,
          display: 'flex',
          textAlign: 'center',
          alignItems: 'center',
          px: { xs: 2, sm: 0 },
          flexDirection: 'column',
        }}
      >
        <Typography variant="h4">
          {requestInProcess
            ? 'Producto solicitado'
            : evaluationInProcess
              ? 'Evaluación en proceso'
              : 'Gracias por tu compra!'}
        </Typography>

        <OrderCompleteIllustration />

        {requestInProcess ? (
          <Typography component="div">
            Tu solicitud quedó registrada con el estado
            <Label variant="soft" color="secondary" sx={{ mx: 0.75 }}>
              Solicitado
            </Label>
            <br />
            <br />
            <Link component={RouterLink} href={orderDetailsPath}>
              {orderNumber || 'Ver solicitud'}
            </Link>
            <br />
            <br />
            {AVISO_SOLICITUD_ENVIADA}
            <br /> Te avisaremos cuando el producto esté disponible.
          </Typography>
        ) : (
          <Typography>
            {evaluationInProcess
              ? 'Tu solicitud fue enviada correctamente'
              : 'Orden creada correctamente'}
            <br />
            <br />
            {receiptDetailsPath ? (
              <Link component={RouterLink} href={receiptDetailsPath}>
                {receiptLabel}
              </Link>
            ) : (
              <Link component="span">{receiptLabel}</Link>
            )}
            <br />
            <br />
            {evaluationInProcess
              ? 'Tu evaluación está en proceso. Te enviaremos una notificación cuando sea revisada.'
              : 'Te enviaremos una notificacion cuando la orden sea procesada.'}
            <br /> Si tienes alguna pregunta, contacta a soporte. <br />
            Gracias,
          </Typography>
        )}

        <Divider sx={{ width: 1, borderStyle: 'dashed' }} />

        <Box
          sx={{
            gap: 2,
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}
        >
          <Button
            component={RouterLink}
            href={continueShoppingPath}
            size="large"
            color="inherit"
            variant="outlined"
            // Tras una solicitud el carrito se deja como estaba: vaciarlo borraba
            // lo que la persona ya iba a comprar, que no tiene que ver con el
            // producto agotado que acaba de pedir.
            onClick={requestInProcess ? undefined : onResetCart}
            startIcon={<Iconify icon="eva:arrow-ios-back-fill" />}
          >
            Continuar comprando
          </Button>

          {receipt && !evaluationInProcess && (
            <InvoicePDFDownload
              invoice={receipt}
              currentStatus={receipt.status}
              fileName={`${receipt.invoiceNumber}.pdf`}
              renderButton={(loading) => (
                <Button
                  size="large"
                  variant="contained"
                  loading={loading}
                  startIcon={<Iconify icon="eva:cloud-download-fill" />}
                >
                  Descargar PDF
                </Button>
              )}
            />
          )}
        </Box>
      </Box>
    </Dialog>
  );
}
