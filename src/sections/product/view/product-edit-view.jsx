'use client';

import { useState, useEffect } from 'react';

import { paths } from 'src/routes/paths';

import { DashboardContent } from 'src/layouts/dashboard';
import { resolverProductoCombinadoPorId } from 'src/services/product-service';

import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

import { ProductDetailsSkeleton } from 'src/sections/product/product-skeleton';

import { ProductCreateEditForm } from '../product-create-edit-form';

// ----------------------------------------------------------------------

export function ProductEditView({ product, productId }) {
  const [resolvedProduct, setResolvedProduct] = useState(product ?? null);
  const [isLoading, setIsLoading] = useState(Boolean(productId) && !product);

  useEffect(() => {
    const loadProduct = async () => {
      if (!productId) return;

      setIsLoading(true);
      const nextProduct = await resolverProductoCombinadoPorId({
        productId,
        productoRemoto: product,
      });

      setResolvedProduct(nextProduct);
      setIsLoading(false);
    };

    loadProduct();
  }, [product, productId]);

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
