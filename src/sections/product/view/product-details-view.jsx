'use client';

import { useTabs } from 'minimal-shared/hooks';
import { varAlpha } from 'minimal-shared/utils';
import { useState, useEffect, useCallback } from 'react';

import Tab from '@mui/material/Tab';
import Box from '@mui/material/Box';
import Tabs from '@mui/material/Tabs';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';

import { paths } from 'src/routes/paths';

import { isMemberSessionUser } from 'src/utils/member-access';

import { PRODUCT_PUBLISH_OPTIONS } from 'src/_mock';
import { DashboardContent } from 'src/layouts/dashboard';
import { resolverProductoCombinadoPorId } from 'src/services/product-service';

import { Iconify } from 'src/components/iconify';

import { ProductDetailsSkeleton } from 'src/sections/product/product-skeleton';

import { useAuthContext } from 'src/auth/hooks';

import { useCheckoutContext } from '../../checkout/context';
import { ProductDetailsReview } from '../product-details-review';
import { ProductDetailsSummary } from '../product-details-summary';
import { ProductDetailsToolbar } from '../product-details-toolbar';
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

export function ProductDetailsView({ product, productId }) {
  const tabs = useTabs('description');
  const { state: checkoutState, onAddToCart } = useCheckoutContext();
  const { user } = useAuthContext();

  const [publish, setPublish] = useState('');
  const [resolvedProduct, setResolvedProduct] = useState(product ?? null);
  const [isLoading, setIsLoading] = useState(Boolean(productId) && !product);
  const isMemberUser = isMemberSessionUser(user);

  useEffect(() => {
    const loadProduct = async () => {
      if (!productId) return;

      setIsLoading(true);
      const nextProduct = await resolverProductoCombinadoPorId({
        productId,
        productoRemoto: product,
      });

      setResolvedProduct(nextProduct);
      setPublish(nextProduct?.publish || '');
      setIsLoading(false);
    };

    loadProduct();
  }, [product, productId]);

  const handleChangePublish = useCallback((newValue) => {
    setPublish(newValue);
  }, []);

  return (
    <DashboardContent>
      {isLoading && !resolvedProduct ? (
        <ProductDetailsSkeleton />
      ) : (
        <>
          <ProductDetailsToolbar
            backHref={paths.dashboard.product.root}
            liveHref={paths.product.details(`${resolvedProduct?.id}`)}
            editHref={paths.dashboard.product.edit(`${resolvedProduct?.id}`)}
            publish={publish}
            onChangePublish={handleChangePublish}
            publishOptions={PRODUCT_PUBLISH_OPTIONS}
            isMemberUser={isMemberUser}
          />

          <Grid container spacing={{ xs: 3, md: 5, lg: 8 }}>
            <Grid size={{ xs: 12, md: 6, lg: 7 }}>
              <ProductDetailsCarousel images={resolvedProduct?.images ?? []} />
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
              <ProductDetailsDescription description={resolvedProduct?.description ?? ''} />
            )}

            {tabs.value === 'reviews' && (
              <ProductDetailsReview
                ratings={resolvedProduct?.ratings ?? []}
                reviews={resolvedProduct?.reviews ?? []}
                totalRatings={resolvedProduct?.totalRatings ?? 0}
                totalReviews={resolvedProduct?.totalReviews ?? 0}
              />
            )}
          </Card>
        </>
      )}
    </DashboardContent>
  );
}
