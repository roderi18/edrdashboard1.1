import useSWR from 'swr';
import { useMemo, useState, useEffect } from 'react';

import { fetcher, endpoints } from 'src/lib/axios';
import { listarProductosFirestore, resolverProductoCombinadoPorId } from 'src/services/product-service';

// ----------------------------------------------------------------------

const swrOptions = {
  revalidateIfStale: false,
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
};

// ----------------------------------------------------------------------

export function useGetProducts() {
  const [resolvedProducts, setResolvedProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState(null);

  useEffect(() => {
    let active = true;

    const loadProducts = async () => {
      setProductsLoading(true);
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
