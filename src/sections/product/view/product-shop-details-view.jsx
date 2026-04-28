'use client';

import { useState, useEffect } from 'react';
import { useTabs } from 'minimal-shared/hooks';
import { varAlpha } from 'minimal-shared/utils';

import Tab from '@mui/material/Tab';
import Box from '@mui/material/Box';
import Tabs from '@mui/material/Tabs';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';

import { paths } from 'src/routes/paths';

import { getLocalProductById } from 'src/utils/local-product-storage';

import { Iconify } from 'src/components/iconify';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

import { CartIcon } from '../cart-icon';
import { useCheckoutContext } from '../../checkout/context';
import { ProductDetailsSkeleton } from '../product-skeleton';
import { ProductDetailsReview } from '../product-details-review';
import { ProductDetailsSummary } from '../product-details-summary';
import { ProductDetailsCarousel } from '../product-details-carousel';
import { ProductDetailsDescription } from '../product-details-description';

// ----------------------------------------------------------------------

const SUMMARY = [
  {
    title: '100% original',
    description: 'Chocolate bar candy canes ice cream toffee cookie halvah.',
    icon: 'solar:verified-check-bold',
  },
  {
    title: '10 days replacement',
    description: 'Marshmallow biscuit donut dragÃ©e fruitcake wafer.',
    icon: 'solar:clock-circle-bold',
  },
  {
    title: 'Year warranty',
    description: 'Cotton candy gingerbread cake I love sugar sweet.',
    icon: 'solar:shield-check-bold',
  },
];

// ----------------------------------------------------------------------

export function ProductShopDetailsView({ product, productId }) {
  const { state: checkoutState, onAddToCart } = useCheckoutContext();

  const tabs = useTabs('description');
  const [resolvedProduct, setResolvedProduct] = useState(product ?? null);
  const [isLoading, setIsLoading] = useState(!product && !!productId?.startsWith('local-product-'));
  const isLocalProduct = productId?.startsWith('local-product-');

  useEffect(() => {
    if (product) {
      setResolvedProduct(product);
      setIsLoading(false);
    }
  }, [product]);

  useEffect(() => {
    if (!isLocalProduct) return;

    const localProduct = getLocalProductById(productId);

    setResolvedProduct(localProduct);
    setIsLoading(false);
  }, [isLocalProduct, productId]);

  return (
    <>
      <CartIcon totalItems={checkoutState.totalItems} />

      <Container sx={{ mb: 10 }}>
        {isLoading && !resolvedProduct ? (
          <ProductDetailsSkeleton />
        ) : (
          <>
            <CustomBreadcrumbs
              links={[
                { name: 'Home', href: '/' },
                { name: 'Shop', href: paths.product.root },
                { name: resolvedProduct?.name },
              ]}
              sx={{ mb: 5, mt: { xs: 1, md: 3 } }}
            />

            <Grid container spacing={{ xs: 3, md: 5, lg: 8 }}>
              <Grid size={{ xs: 12, md: 6, lg: 7 }}>
                <ProductDetailsCarousel images={resolvedProduct?.images} />
              </Grid>

              <Grid size={{ xs: 12, md: 6, lg: 5 }}>
                {resolvedProduct && (
                  <ProductDetailsSummary
                    product={resolvedProduct}
                    items={checkoutState.items}
                    onAddToCart={onAddToCart}
                    disableActions={!resolvedProduct?.available}
                  />
                )}
              </Grid>
            </Grid>
            <Box
              sx={{
                gap: 5,
                my: 10,
                display: 'grid',
                gridTemplateColumns: { xs: 'repeat(1, 1fr)', md: 'repeat(3, 1fr)' },
              }}
            >
              {SUMMARY.map((item) => (
                <Box key={item.title} sx={{ textAlign: 'center', px: 5 }}>
                  <Iconify icon={item.icon} width={32} sx={{ color: 'primary.main' }} />

                  <Typography variant="subtitle1" sx={{ mb: 1, mt: 2 }}>
                    {item.title}
                  </Typography>

                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {item.description}
                  </Typography>
                </Box>
              ))}
            </Box>

            <Card>
              <Tabs
                value={tabs.value}
                onChange={tabs.onChange}
                sx={[
                  (theme) => ({
                    px: 3,
                    boxShadow: `inset 0 -2px 0 0 ${varAlpha(theme.vars.palette.grey['500Channel'], 0.08)}`,
                  }),
                ]}
              >
                {[
                  { value: 'description', label: 'Description' },
                  { value: 'reviews', label: `Reviews (${resolvedProduct?.reviews?.length || 0})` },
                ].map((tab) => (
                  <Tab key={tab.value} value={tab.value} label={tab.label} />
                ))}
              </Tabs>

              {tabs.value === 'description' && (
                <ProductDetailsDescription description={resolvedProduct?.description} />
              )}

              {tabs.value === 'reviews' && (
                <ProductDetailsReview
                  ratings={resolvedProduct?.ratings}
                  reviews={resolvedProduct?.reviews}
                  totalRatings={resolvedProduct?.totalRatings}
                  totalReviews={resolvedProduct?.totalReviews}
                />
              )}
            </Card>
          </>
        )}
      </Container>
    </>
  );
}
