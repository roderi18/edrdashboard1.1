import useSWR from 'swr';
import { useMemo, useState, useEffect } from 'react';

import { valorGuardado } from 'src/utils/cache-de-lecturas.mjs';

import { fetcher, endpoints } from 'src/lib/axios';
import { listarProductosFirestore, resolverProductoCombinadoPorId } from 'src/services/product-service';

// ----------------------------------------------------------------------

const swrOptions = {
  revalidateIfStale: false,
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
};

// ----------------------------------------------------------------------

// La misma clave que `conCache` da a `listarProductosFirestore()` (sin argumentos).
const CLAVE_PRODUCTOS = 'tienda-productos:listarProductosFirestore:[]';

export function useGetProducts() {
  // Lo ya leído en esta pestaña se pinta en el primer render: volver a la tienda
  // no pasa otra vez por el esqueleto (se relee por detrás si es viejo).
  const [resolvedProducts, setResolvedProducts] = useState(
    () => valorGuardado(CLAVE_PRODUCTOS) || []
  );
  const [productsLoading, setProductsLoading] = useState(() => !valorGuardado(CLAVE_PRODUCTOS));
  const [productsError, setProductsError] = useState(null);

  useEffect(() => {
    let active = true;

    const loadProducts = async () => {
      setProductsError(null);

      try {
        const firestoreProducts = await listarProductosFirestore();

        if (!active) return;

        setResolvedProducts(firestoreProducts);
      } catch (loadError) {
        if (!active) return;

        setProductsError(loadError);
        setResolvedProducts([]);
      } finally {
        if (active) {
          setProductsLoading(false);
        }
      }
    };

    loadProducts();

    return () => {
      active = false;
    };
  }, []);

  const memoizedValue = useMemo(
    () => ({
      products: resolvedProducts,
      productsLoading,
      productsError,
      productsValidating: productsLoading,
      productsEmpty: !productsLoading && !resolvedProducts.length,
    }),
    [productsError, productsLoading, resolvedProducts]
  );

  return memoizedValue;
}

// ----------------------------------------------------------------------

export function useGetProduct(productId) {
  const url = productId ? [endpoints.product.details, { params: { productId } }] : '';

  const { data, isLoading, error, isValidating } = useSWR(url, fetcher, {
    ...swrOptions,
  });
  const [resolvedProduct, setResolvedProduct] = useState(null);

  useEffect(() => {
    let active = true;

    const loadProduct = async () => {
      if (!productId) {
        setResolvedProduct(null);
        return;
      }

      const combinedProduct = await resolverProductoCombinadoPorId({
        productId,
        productoRemoto: data?.product || null,
      });

      if (!active) return;

      setResolvedProduct(combinedProduct);
    };

    loadProduct();

    return () => {
      active = false;
    };
  }, [data?.product, productId]);

  const memoizedValue = useMemo(
    () => ({
      product: resolvedProduct,
      productLoading: isLoading && !resolvedProduct,
      productError: error,
      productValidating: isValidating,
    }),
    [error, isLoading, isValidating, resolvedProduct]
  );

  return memoizedValue;
}

// ----------------------------------------------------------------------

export function useSearchProducts(query) {
  const url = query ? [endpoints.product.search, { params: { query } }] : '';

  const { data, isLoading, error, isValidating } = useSWR(url, fetcher, {
    ...swrOptions,
    keepPreviousData: true,
  });

  const memoizedValue = useMemo(
    () => ({
      searchResults: data?.results || [],
      searchLoading: isLoading,
      searchError: error,
      searchValidating: isValidating,
      searchEmpty: !isLoading && !isValidating && !data?.results.length,
    }),
    [data?.results, error, isLoading, isValidating]
  );

  return memoizedValue;
}
