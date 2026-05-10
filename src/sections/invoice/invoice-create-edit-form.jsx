import * as z from 'zod';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useBoolean } from 'minimal-shared/hooks';
import { zodResolver } from '@hookform/resolvers/zod';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Button from '@mui/material/Button';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';

import { today, fIsAfter } from 'src/utils/format-time';

import { _addressBooks, INVOICE_SERVICE_OPTIONS } from 'src/_mock';
import { actualizarReciboFirestore } from 'src/services/receipt-service';

import { Form, schemaUtils } from 'src/components/hook-form';

import { InvoiceCreateEditAddress } from './invoice-create-edit-address';
import { InvoiceCreateEditStatusDate } from './invoice-create-edit-status-date';
import { defaultItem, InvoiceCreateEditDetails } from './invoice-create-edit-details';

// ----------------------------------------------------------------------

const getValidService = (service) =>
  INVOICE_SERVICE_OPTIONS.some((option) => option.name === service)
    ? service
    : INVOICE_SERVICE_OPTIONS[0].name;

const normalizeInvoice = (invoice) => {
  if (!invoice) return invoice;

  return {
    ...invoice,
    taxes: Number(invoice.taxes) || 0,
    status: invoice.status || 'draft',
    discount: Number(invoice.discount) || 0,
    shipping: Number(invoice.shipping) || 0,
    subtotal: Number(invoice.subtotal) || 0,
    totalAmount: Number(invoice.totalAmount) || 0,
    invoiceFrom: invoice.invoiceFrom || _addressBooks[0],
    invoiceTo: invoice.invoiceTo || null,
    items: (invoice.items?.length ? invoice.items : [defaultItem]).map((item) => ({
      ...defaultItem,
      ...item,
      title: item.title || item.name || 'Producto',
      description: item.description || 'Compra Firestore',
      service: getValidService(item.service),
      quantity: Number(item.quantity) || 1,
      price: Number(item.price) || 0,
      total: Number(item.total) || (Number(item.quantity) || 1) * (Number(item.price) || 0),
    })),
  };
};

// ----------------------------------------------------------------------

export const InvoiceCreateSchema = z
  .object({
    invoiceTo: schemaUtils.nullableInput(z.custom(), {
      error: 'La factura destino es obligatoria!',
    }),
    createDate: schemaUtils.date({ error: { required: 'La fecha de creacion es obligatoria!' } }),
    dueDate: schemaUtils.date({ error: { required: 'La fecha de vencimiento es obligatoria!' } }),
    items: z.array(
      z.object({
        title: z.string().min(1, { error: 'El titulo es obligatorio!' }),
        service: z.string().min(1, { error: 'El servicio es obligatorio!' }),
        quantity: z.number().int().positive().min(1, { error: 'La cantidad debe ser mayor que 0' }),
        // Not required
        price: z.number(),
        total: z.number(),
        description: z.string(),
      })
    ),
    // Not required
    taxes: z.number(),
    status: z.string(),
    discount: z.number(),
    shipping: z.number(),
    subtotal: z.number(),
    totalAmount: z.number(),
    invoiceNumber: z.string(),
    invoiceFrom: z.custom().nullable(),
  })
  .refine((val) => !fIsAfter(val.createDate, val.dueDate), {
    error: 'La fecha de vencimiento no puede ser anterior a la fecha de creacion!',
    path: ['dueDate'],
  });

// ----------------------------------------------------------------------

export function InvoiceCreateEditForm({ currentInvoice }) {
  const router = useRouter();

  const loadingSave = useBoolean();
  const loadingSend = useBoolean();

  const defaultValues = {
    invoiceNumber: 'INV-1990',
    createDate: today(),
    dueDate: null,
    taxes: 0,
    shipping: 0,
    status: 'draft',
    discount: 0,
    invoiceFrom: _addressBooks[0],
    invoiceTo: null,
    subtotal: 0,
    totalAmount: 0,
    items: [defaultItem],
  };

  const currentValues = useMemo(() => normalizeInvoice(currentInvoice), [currentInvoice]);

  const methods = useForm({
    mode: 'all',
    resolver: zodResolver(InvoiceCreateSchema),
    defaultValues,
    values: currentValues,
  });

  const {
    reset,
    handleSubmit,
    formState: { isSubmitting },
  } = methods;

  const updateReceipt = (data) =>
    currentInvoice?.id
      ? actualizarReciboFirestore(currentInvoice.id, { ...currentInvoice, ...data })
      : null;

  const handleSaveAsDraft = handleSubmit(async (data) => {
    loadingSave.onTrue();

    try {
      await new Promise((resolve) => setTimeout(resolve, 500));
      await updateReceipt({ ...data, status: 'draft' });
      reset();
      loadingSave.onFalse();
      router.push(paths.dashboard.invoice.root);
      console.info('DATA', JSON.stringify(data, null, 2));
    } catch (error) {
      console.error(error);
      loadingSave.onFalse();
    }
  });

  const handleCreateAndSend = handleSubmit(async (data) => {
    loadingSend.onTrue();

    try {
      await new Promise((resolve) => setTimeout(resolve, 500));
      await updateReceipt(data);
      reset();
      loadingSend.onFalse();
      router.push(paths.dashboard.invoice.root);
      console.info('DATA', JSON.stringify(data, null, 2));
    } catch (error) {
      console.error(error);
      loadingSend.onFalse();
    }
  });

  return (
    <Form methods={methods}>
      <Card>
        <InvoiceCreateEditAddress />
        <InvoiceCreateEditStatusDate />
        <InvoiceCreateEditDetails />
      </Card>

      <Box
        sx={{
          mt: 3,
          gap: 2,
          display: 'flex',
          justifyContent: 'flex-end',
        }}
      >
        <Button
          color="inherit"
          size="large"
          variant="outlined"
          loading={loadingSave.value && isSubmitting}
          onClick={handleSaveAsDraft}
        >
          Guardar borrador
        </Button>

        <Button
          size="large"
          variant="contained"
          loading={loadingSend.value && isSubmitting}
          onClick={handleCreateAndSend}
        >
          {currentInvoice ? 'Actualizar' : 'Crear'} y enviar
        </Button>
      </Box>
    </Form>
  );
}
