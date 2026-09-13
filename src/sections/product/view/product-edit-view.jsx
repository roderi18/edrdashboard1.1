'use client';

import { useState, useEffect } from 'react';

import Alert from '@mui/material/Alert';

import { paths } from 'src/routes/paths';

import { canEditStoreProduct } from 'src/utils/member-access';

import { DashboardContent } from 'src/layouts/dashboard';
import { resolverProductoCombinadoPorId } from 'src/services/product-service';

import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

import { ProductDetailsSkeleton } from 'src/sections/product/product-skeleton';

import { useAuthContext } from 'src/auth/hooks';

import { ProductCreateEditForm } from '../product-create-edit-form';

// ----------------------------------------------------------------------

export function ProductEditView({ product, productId }) {
  const { user, loading } = useAuthContext();
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

  // Se vuelve a la ficha del producto, que es de donde sale el lapiz: volver a
  // la lista obligaba a buscarlo otra vez para ver como habia quedado.
  const productHref = productId
    ? paths.dashboard.product.details(productId)
    : paths.dashboard.product.root;

  if (loading) {
    return null;
  }

  // La direccion /edit se puede escribir a mano. Sin esto cualquiera con sesion
  // veia el formulario del producto con sus notas administrativas, aunque el
  // lapiz solo se le enseñe a quien puede editar.
  const canEdit = canEditStoreProduct(user);

  return (
    <DashboardContent>
      <CustomBreadcrumbs
        heading="Editar"
        backHref={productHref}
        links={[
          { name: 'Panel', href: paths.dashboard.root },
          { name: 'Producto', href: paths.dashboard.product.root },
          { name: resolvedProduct?.name || 'Cargando', href: productHref },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      {!canEdit ? (
        <Alert severity="warning">No tienes permisos para editar productos.</Alert>
      ) : isLoading && !resolvedProduct ? (
        <ProductDetailsSkeleton />
      ) : (
        <ProductCreateEditForm currentProduct={resolvedProduct} />
      )}
    </DashboardContent>
  );
}
