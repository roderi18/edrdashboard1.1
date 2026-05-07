'use client';

import { useTabs } from 'minimal-shared/hooks';
import { varAlpha } from 'minimal-shared/utils';
import { useState, useEffect, useCallback } from 'react';

import Tab from '@mui/material/Tab';
import Box from '@mui/material/Box';
import Tabs from '@mui/material/Tabs';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';

import { paths } from 'src/routes/paths';

import { isMemberSessionUser } from 'src/utils/member-access';
import { mergeProductReviews, buildProductReviewStats } from 'src/utils/product-reviews-storage';

import { resolverProductoCombinadoPorId } from 'src/services/product-service';

import { Iconify } from 'src/components/iconify';
import { EmptyContent } from 'src/components/empty-content';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

import { useAuthContext } from 'src/auth/hooks';

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
    description: 'Producto verificado y registrado en el inventario oficial.',
    icon: 'solar:verified-check-bold',
  },
  {
    title: '10 dias para reemplazo',
    description: 'Puedes solicitar revision o reemplazo segun disponibilidad.',
    icon: 'solar:clock-circle-bold',
  },
  {
    title: 'Garantia anual',
    description: 'Cobertura de seguimiento para productos aprobados.',
    icon: 'solar:shield-check-bold',
  },
];

// ----------------------------------------------------------------------

export function ProductShopDetailsView({ product, productId }) {
  const { state: checkoutState, onAddToCart } = useCheckoutContext();
  const { user } = useAuthContext();

  const tabs = useTabs('description');
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
      const mergedReviews = mergeProductReviews(nextProduct?.id, nextProduct?.reviews ?? []);
      const stats = buildProductReviewStats(mergedReviews);

      setResolvedProduct(
        nextProduct
          ? {
              ...nextProduct,
              reviews: mergedReviews,
              ratings: stats.ratings,
              totalRatings: stats.totalRatings,
              totalReviews: stats.totalReviews,
            }
          : nextProduct
      );
      setIsLoading(false);
    };

    loadProduct();
  }, [product, productId]);

  const handleReviewsChange = useCallback((nextReviews) => {
    const stats = buildProductReviewStats(nextReviews);

    setResolvedProduct((currentProduct) =>
      currentProduct
        ? {
            ...currentProduct,
            reviews: nextReviews,
            ratings: stats.ratings,
            totalRatings: stats.totalRatings,
            totalReviews: stats.totalReviews,
          }
        : currentProduct
    );
  }, []);

  return (
    <>
      <CartIcon totalItems={checkoutState.totalItems} />

      <Container sx={{ mb: 10 }}>
        {isLoading && !resolvedProduct ? (
          <ProductDetailsSkeleton />
        ) : isMemberUser && resolvedProduct?.publish !== 'published' ? (
          <EmptyContent title="Producto no disponible" filled sx={{ py: 10 }} />
        ) : (
          <>
            <CustomBreadcrumbs
              links={[
                { name: 'Inicio', href: '/' },
                { name: 'Tienda', href: paths.product.root },
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
                  { value: 'description', label: 'Descripcion' },
                  { value: 'reviews', label: `Resenas (${resolvedProduct?.reviews?.length || 0})` },
                ].map((tab) => (
                  <Tab key={tab.value} value={tab.value} label={tab.label} />
                ))}
              </Tabs>

              {tabs.value === 'description' && (
                <ProductDetailsDescription description={resolvedProduct?.description} />
              )}

              {tabs.value === 'reviews' && (
                <ProductDetailsReview
                  productId={resolvedProduct?.id}
                  ratings={resolvedProduct?.ratings}
                  reviews={resolvedProduct?.reviews}
                  reviewer={user}
                  onReviewsChange={handleReviewsChange}
                />
              )}
            </Card>
          </>
        )}
      </Container>
    </>
  );
}
