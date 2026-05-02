import { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Table from '@mui/material/Table';
import Stack from '@mui/material/Stack';
import Divider from '@mui/material/Divider';
import TableRow from '@mui/material/TableRow';
import TableHead from '@mui/material/TableHead';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import Typography from '@mui/material/Typography';

import { fDopCurrency } from 'src/utils/format-number';
import { isMemberSessionUser } from 'src/utils/member-access';
import { fDate, fDateTimeEsLong } from 'src/utils/format-time';
import { TEXTO_SIN_TELEFONO, TEXTO_SIN_DIRECCION } from 'src/utils/firestore-commerce';

import { INVOICE_STATUS_OPTIONS } from 'src/_mock';
import { actualizarEstadoReciboFirestore } from 'src/services/receipt-service';

import { Label } from 'src/components/label';
import { toast } from 'src/components/snackbar';
import { Scrollbar } from 'src/components/scrollbar';

import { useAuthContext } from 'src/auth/hooks';

import { InvoiceToolbar } from './invoice-toolbar';
import { InvoiceTotalSummary } from './invoice-total-summary';

// ----------------------------------------------------------------------

const STATUS_LABELS = {
  paid: 'Pagado',
  pending: 'Pendiente',
  overdue: 'Vencido',
  draft: 'Borrador',
};

export function InvoiceDetails({ invoice }) {
  const { user } = useAuthContext();
  const canEditStatus = !isMemberSessionUser(user);
  const [currentStatus, setCurrentStatus] = useState(invoice?.status || 'paid');

  useEffect(() => {
    setCurrentStatus(invoice?.status || 'paid');
  }, [invoice?.status]);

  const handleChangeStatus = useCallback(
    async (event) => {
      const nextStatus = event.target.value;

      if (!canEditStatus || !invoice?.id) {
        return;
      }

      const previousStatus = currentStatus;
      setCurrentStatus(nextStatus);

      try {
        const updatedInvoice = await actualizarEstadoReciboFirestore(invoice.id, nextStatus);

        setCurrentStatus(updatedInvoice?.status || nextStatus);
        toast.success('Estado del recibo actualizado');
      } catch {
        setCurrentStatus(previousStatus);
        toast.error('No se pudo actualizar el estado del recibo');
      }
    },
    [canEditStatus, currentStatus, invoice?.id]
  );

  const displayStatus = currentStatus || 'paid';

  const renderFooter = () => (
    <Box
      sx={{
        py: 3,
        gap: 2,
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
      }}
    >
      <div>
        <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
          NOTAS
        </Typography>
        <Typography variant="body2">
          Agradecemos tu compra. Si necesitas agregar ITBIS o notas extra, avisanos.
        </Typography>
      </div>

      <Box sx={{ flexGrow: { md: 1 }, textAlign: { md: 'right' } }}>
        <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
          Tienes una pregunta?
        </Typography>
        <Typography variant="body2">soporte@soporte.com</Typography>
      </Box>
    </Box>
  );

  const renderList = () => (
    <Scrollbar sx={{ mt: 5 }}>
      <Table sx={{ minWidth: 960 }}>
        <TableHead>
          <TableRow>
            <TableCell width={40}>#</TableCell>
            <TableCell sx={{ typography: 'subtitle2' }}>Descripcion</TableCell>
            <TableCell>Cant.</TableCell>
            <TableCell align="right">Precio unitario</TableCell>
            <TableCell align="right">Total</TableCell>
          </TableRow>
        </TableHead>

        <TableBody>
          {invoice?.items.map((row, index) => (
            <TableRow key={index}>
              <TableCell>{index + 1}</TableCell>

              <TableCell>
                <Box sx={{ maxWidth: 560 }}>
                  <Typography variant="subtitle2">{row.title}</Typography>

                  <Typography variant="body2" sx={{ color: 'text.secondary' }} noWrap>
                    {row.description}
                  </Typography>
                </Box>
              </TableCell>

              <TableCell>{row.quantity}</TableCell>
              <TableCell align="right">{fDopCurrency(row.price)}</TableCell>
              <TableCell align="right">{fDopCurrency(row.price * row.quantity)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Scrollbar>
  );

  return (
    <>
      <InvoiceToolbar
        invoice={invoice}
        currentStatus={displayStatus}
        onChangeStatus={handleChangeStatus}
        canEditStatus={canEditStatus}
        statusOptions={INVOICE_STATUS_OPTIONS}
      />

      <Card sx={{ pt: 5, px: 5 }}>
        <Box
          sx={{
            rowGap: 5,
            display: 'grid',
            alignItems: 'center',
            gridTemplateColumns: { xs: 'repeat(1, 1fr)', sm: 'repeat(2, 1fr)' },
          }}
        >
          <Box
            component="img"
            alt="Invoice logo"
            src="/logo/logo-single.svg"
            sx={{ width: 48, height: 48 }}
          />

          <Stack spacing={1} sx={{ alignItems: { xs: 'flex-start', md: 'flex-end' } }}>
            <Label
              variant="soft"
              color={
                (displayStatus === 'paid' && 'success') ||
                (displayStatus === 'pending' && 'warning') ||
                (displayStatus === 'overdue' && 'error') ||
                'default'
              }
            >
              {STATUS_LABELS[displayStatus] || displayStatus}
            </Label>

            <Typography variant="h6">{invoice?.invoiceNumber}</Typography>
          </Stack>

          <Stack sx={{ typography: 'body2' }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Factura desde
            </Typography>
            {invoice?.invoiceFrom.name}
            <br />
            {invoice?.invoiceFrom.fullAddress}
            <br />
            Telefono: {invoice?.invoiceFrom.phoneNumber}
            <br />
          </Stack>

          <Stack sx={{ typography: 'body2' }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Factura a
            </Typography>
            {invoice?.invoiceTo.name}
            <br />
            {invoice?.invoiceTo.fullAddress || TEXTO_SIN_DIRECCION}
            <br />
            Telefono: {invoice?.invoiceTo.phoneNumber || TEXTO_SIN_TELEFONO}
            <br />
            {invoice?.invoiceTo.codigoMiembro && (
              <>
                Codigo: {String(invoice.invoiceTo.codigoMiembro).toUpperCase()}
                <br />
              </>
            )}
            {invoice?.invoiceTo.memberRole && (
              <>
                Rol: {invoice.invoiceTo.memberRole}
                <br />
              </>
            )}
            {(invoice?.invoiceTo.memberId || invoice?.invoiceTo.idMiembros) && (
              <>
                ID miembro: {invoice.invoiceTo.memberId || invoice.invoiceTo.idMiembros}
                <br />
              </>
            )}
            {invoice?.invoiceTo.company && (
              <>
                Correo: {invoice.invoiceTo.company}
                <br />
              </>
            )}
            {!invoice?.invoiceTo.company && (
              <>
                Correo no especificado
                <br />
              </>
            )}
          </Stack>

          <Stack sx={{ typography: 'body2' }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Fecha de creacion
            </Typography>
            {fDateTimeEsLong(invoice?.createDate)}
          </Stack>

          <Stack sx={{ typography: 'body2' }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Fecha de vencimiento
            </Typography>
            {fDate(invoice?.dueDate)}
          </Stack>
        </Box>

        {renderList()}

        <Divider sx={{ borderStyle: 'dashed' }} />

        <InvoiceTotalSummary
          taxes={invoice?.taxes}
          subtotal={invoice?.subtotal}
          discount={invoice?.discount}
          shipping={invoice?.shipping}
          totalAmount={invoice?.totalAmount}
        />

        <Divider sx={{ mt: 5, borderStyle: 'dashed' }} />

        {renderFooter()}
      </Card>
    </>
  );
}
