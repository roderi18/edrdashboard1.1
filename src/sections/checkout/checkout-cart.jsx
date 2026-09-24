import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import CardHeader from '@mui/material/CardHeader';
import Typography from '@mui/material/Typography';

import { paths } from 'src/routes/paths';
import { usePathname } from 'src/routes/hooks';
import { RouterLink } from 'src/routes/components';

import { CONFIG } from 'src/global-config';

import { Iconify } from 'src/components/iconify';
import { EmptyContent } from 'src/components/empty-content';

import { useCheckoutContext } from './context';
import { CheckoutSummary } from './checkout-summary';
import { CheckoutTrustBadges } from './checkout-trust-badges';
import { CheckoutCartProductList } from './checkout-cart-product-list';

// ----------------------------------------------------------------------

export function CheckoutCart() {
  const pathname = usePathname();
  const continueShoppingPath = pathname.includes(paths.dashboard.root)
    ? paths.dashboard.product.root
    : paths.product.root;

  const {
    loading,
    onChangeStep,
    onApplyDiscount,
    onDeleteCartItem,
    state: checkoutState,
    onChangeItemQuantity,
  } = useCheckoutContext();

  const isCartEmpty = !checkoutState.items.length;

  // Las filas del carrito en esqueleto, no una barra de progreso en un hueco.
  const renderLoading = () => (
    <Stack spacing={2.5} sx={{ p: 3 }}>
      {[0, 1, 2].map((fila) => (
        <Stack key={fila} direction="row" spacing={2} alignItems="center">
          <Skeleton variant="rounded" width={64} height={64} />
          <Stack spacing={0.5} sx={{ flex: 1 }}>
            <Skeleton variant="text" width="50%" />
            <Skeleton variant="text" width="30%" />
          </Stack>
          <Skeleton variant="rounded" width={88} height={32} />
        </Stack>
      ))}
    </Stack>
  );

  const renderEmpty = () => (
    <EmptyContent
      title="El carrito esta vacio!"
      description="No tienes articulos en tu carrito."
      imgUrl={`${CONFIG.assetsDir}/assets/icons/empty/ic-cart.svg`}
      sx={{ height: 340 }}
    />
  );

  return (
    <Grid container spacing={3}>
      <Grid size={{ xs: 12, md: 8 }}>
        <Card sx={{ mb: 3 }}>
          <CardHeader
            title={
              <Typography variant="h6">
                {`Carrito `}
                <Typography component="span" sx={{ color: 'text.secondary' }}>
                  ({checkoutState.totalItems} articulos)
                </Typography>
              </Typography>
            }
            sx={{ mb: 3 }}
          />

          {loading ? (
            renderLoading()
          ) : (
            <>
              {isCartEmpty ? (
                renderEmpty()
              ) : (
                <CheckoutCartProductList
                  checkoutState={checkoutState}
                  onDeleteCartItem={onDeleteCartItem}
                  onChangeItemQuantity={onChangeItemQuantity}
                />
              )}
            </>
          )}
        </Card>

        <Button
          component={RouterLink}
          href={continueShoppingPath}
          color="inherit"
          startIcon={<Iconify icon="eva:arrow-ios-back-fill" />}
        >
          Continuar comprando
        </Button>
      </Grid>

      <Grid size={{ xs: 12, md: 4 }}>
        <CheckoutSummary checkoutState={checkoutState} onApplyDiscount={onApplyDiscount} />

        <Button
          fullWidth
          size="large"
          type="submit"
          variant="contained"
          disabled={isCartEmpty}
          onClick={() => onChangeStep('next')}
        >
          Continuar
        </Button>

        {/* LAS GARANTIAS, DESPUES DEL BOTON. Es el momento de la duda, y es lo
            que la responde.

            "Envio gratis" solo se promete cuando el resumen NO esta cobrando
            envio: prometerlo con un cargo a la vista, dos lineas mas arriba, es
            perder la confianza que este cuadro venia a dar. */}
        <CheckoutTrustBadges
          items={[
            { label: 'Compra segura', icono: 'custom:garantia-escudo' },
            ...(checkoutState.shipping
              ? []
              : [{ label: 'Envío gratis', icono: 'custom:garantia-envio' }]),
            { label: 'Garantía ER', icono: 'custom:garantia-medalla' },
          ]}
        />
      </Grid>
    </Grid>
  );
}
