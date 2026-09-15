'use client';

import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';

import {
  ANCHO_DEL_MARCO,
  RELLENO_DEL_MARCO,
  ANCHO_DEL_CONTENIDO,
} from 'src/components/commerce/commerce-layout';

import { CheckoutCart } from '../checkout-cart';
import { useCheckoutContext } from '../context';
import { CheckoutSteps } from '../checkout-steps';
import { CheckoutPayment } from '../checkout-payment';
import { StoreHeader } from '../../product/store-header';
import { CheckoutOrderComplete } from '../checkout-order-complete';
import { CheckoutBillingAddress } from '../checkout-billing-address';

// ----------------------------------------------------------------------

export function CheckoutView() {
  const { steps, activeStep, completed, onResetCart, state: checkoutState } = useCheckoutContext();

  // EL MISMO MARCO QUE `/dashboard/product`, para que la portada mida lo mismo
  // aqui que alli. Este `Container` venia con el tope de la plantilla ('lg',
  // 1200) y su relleno de 24: la portada salia unos 370 pixeles mas estrecha que
  // en la tienda y, como su alto se calcula a partir del ancho, tambien mas
  // baja. Con el mismo tope (1600) y el mismo relleno (40, el de
  // `DashboardContent`), sale identica.
  return (
    <Container
      maxWidth={false}
      sx={{ mb: 10, mx: 'auto', maxWidth: ANCHO_DEL_MARCO, px: RELLENO_DEL_MARCO }}
    >
      {/* LA MISMA PORTADA QUE LA TIENDA. Finalizar la compra es el ultimo paso
          de la tienda, no otro sitio: entrar en una pantalla sin su rotulo —con
          los datos de pago por delante— es justo donde a la gente le entra la
          duda de si sigue donde estaba.
          
          Sale de la misma configuracion, asi que se edita una vez y vale aqui,
          en la lista, en pedidos y en recibos. */}
      <StoreHeader sx={{ mt: 3 }} />

      {/* DEBAJO DE LA PORTADA, MAS ESTRECHO —como en recibos—. Un formulario de
          pago repartido en 1520 pixeles deja los campos a un palmo unos de
          otros y la columna del resumen en la otra punta de la pantalla. */}
      <Box sx={{ width: 1, mx: 'auto', maxWidth: ANCHO_DEL_CONTENIDO }}>
        <Typography variant="h4" sx={{ my: { xs: 3, md: 5 } }}>
          Finalizar compra
        </Typography>

        <Grid container justifyContent={completed ? 'center' : 'flex-start'}>
          <Grid size={{ xs: 12, md: 8 }}>
            <CheckoutSteps steps={steps} activeStep={activeStep ?? 0} />
          </Grid>
        </Grid>

        <>
          {activeStep === 0 && <CheckoutCart />}

          {activeStep === 1 && <CheckoutBillingAddress />}

          {activeStep === 2 && <CheckoutPayment />}

          {completed && (
            <CheckoutOrderComplete
              open
              receipt={checkoutState.receipt}
              orderId={checkoutState.order?.id}
              orderNumber={checkoutState.order?.orderNumber}
              evaluationInProcess={checkoutState.order?.requiereEvaluacion}
              requestInProcess={checkoutState.order?.esSolicitud}
              onResetCart={onResetCart}
            />
          )}
        </>
      </Box>
    </Container>
  );
}
