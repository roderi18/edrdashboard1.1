import * as z from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import FormHelperText from '@mui/material/FormHelperText';

import { Form } from 'src/components/hook-form';
import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';

import { useCheckoutContext } from './context';
import { CheckoutSummary } from './checkout-summary';
import { CheckoutDelivery } from './checkout-delivery';
import { CheckoutBillingInfo } from './checkout-billing-info';
import { CheckoutPaymentMethods } from './checkout-payment-methods';

// ----------------------------------------------------------------------

const DELIVERY_OPTIONS = [
  { value: 0, label: 'Gratis', description: 'Entrega en 5-7 dias' },
  { value: 10, label: 'Estandar', description: 'Entrega en 3-5 dias' },
  { value: 20, label: 'Expreso', description: 'Entrega en 2-3 dias' },
];

const PAYMENT_OPTIONS = [
  {
    value: 'paypal',
    label: 'Pagar con Paypal',
    description: 'Seras redirigido a PayPal para completar la compra de forma segura.',
  },
  {
    value: 'creditcard',
    label: 'Tarjeta de credito / debito',
    description: 'Aceptamos Mastercard, Visa, Discover y Stripe.',
  },
  { value: 'cash', label: 'Efectivo', description: 'Paga en efectivo al recibir tu orden.' },
];

const CARD_OPTIONS = [
  { value: 'visa1', label: '**** **** **** 1212 - Jimmy Holland' },
  { value: 'visa2', label: '**** **** **** 2424 - Shawn Stokes' },
  { value: 'mastercard', label: '**** **** **** 4545 - Cole Armstrong' },
];

// ----------------------------------------------------------------------

export const PaymentSchema = z.object({
  payment: z.string().min(1, { error: 'El metodo de pago es obligatorio.' }),
  // Not required
  delivery: z.number(),
});

// ----------------------------------------------------------------------

export function CheckoutPayment() {
  const {
    loading,
    onChangeStep,
    onCreateOrder,
    onApplyShipping,
    state: checkoutState,
  } = useCheckoutContext();

  const defaultValues = {
    delivery: checkoutState.shipping,
    payment: '',
  };

  const methods = useForm({
    resolver: zodResolver(PaymentSchema),
    defaultValues,
  });

  const {
    handleSubmit,
    formState: { isSubmitting, errors },
  } = methods;

  const onSubmit = handleSubmit(async (data) => {
    try {
      await onCreateOrder(data);
      onChangeStep('next');
      console.info('DATA', data);
    } catch (error) {
      console.error(error);
      toast.error('No se pudo completar la orden.');
    }
  });

  return (
    <Form methods={methods} onSubmit={onSubmit}>
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 8 }}>
          <CheckoutDelivery
            name="delivery"
            onApplyShipping={onApplyShipping}
            options={DELIVERY_OPTIONS}
          />

          <CheckoutPaymentMethods
            name="payment"
            hideError
            options={{ cards: CARD_OPTIONS, payments: PAYMENT_OPTIONS }}
            sx={{ my: 3 }}
          />

          <Button
            size="small"
            color="inherit"
            onClick={() => onChangeStep('back')}
            startIcon={<Iconify icon="eva:arrow-ios-back-fill" />}
          >
            Atras
          </Button>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <CheckoutBillingInfo
            loading={loading}
            onChangeStep={onChangeStep}
            checkoutState={checkoutState}
          />

          <CheckoutSummary checkoutState={checkoutState} onEdit={() => onChangeStep('go', 0)} />

          <Stack spacing={1}>
            <Button fullWidth size="large" type="submit" variant="contained" loading={isSubmitting}>
              Completar orden
            </Button>

            {!!errors.payment && (
              <FormHelperText error sx={{ textAlign: 'center' }}>
                {errors.payment.message}
              </FormHelperText>
            )}
          </Stack>
        </Grid>
      </Grid>
    </Form>
  );
}
