'use client';

import { useState, useEffect } from 'react';

import { paths } from 'src/routes/paths';

import { getLocalProductById } from 'src/utils/local-product-storage';

import { DashboardContent } from 'src/layouts/dashboard';

import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

import { ProductDetailsSkeleton } from 'src/sections/product/product-skeleton';

import { ProductCreateEditForm } from '../product-create-edit-form';

// ----------------------------------------------------------------------

export function ProductEditView({ product, productId }) {
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
    <DashboardContent>
      <CustomBreadcrumbs
        heading="Editar"
        backHref={paths.dashboard.product.root}
        links={[
          { name: 'Panel', href: paths.dashboard.root },
          { name: 'Producto', href: paths.dashboard.product.root },
          { name: resolvedProduct?.name || 'Cargando' },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      {isLoading && !resolvedProduct ? (
        <ProductDetailsSkeleton />
      ) : (
        <ProductCreateEditForm currentProduct={resolvedProduct} />
      )}
    </DashboardContent>
  );
}
