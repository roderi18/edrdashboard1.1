import useSWR from 'swr';
import { useMemo, useState, useEffect } from 'react';

import { mergeProductWithLocalInventory, mergeProductsWithLocalInventory } from 'src/utils/local-product-storage';

import { fetcher, endpoints } from 'src/lib/axios';
import { listarProductosCombinados, resolverProductoCombinadoPorId } from 'src/services/product-service';

// ----------------------------------------------------------------------

const swrOptions = {
  revalidateIfStale: false,
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
};

// ----------------------------------------------------------------------

export function useGetProducts() {
  const url = endpoints.product.list;

  const { data, isLoading, error, isValidating } = useSWR(url, fetcher, {
    ...swrOptions,
  });
  const [resolvedProducts, setResolvedProducts] = useState([]);

  useEffect(() => {
    let active = true;

    const loadProducts = async () => {
      const combinedProducts = await listarProductosCombinados(data?.products || []);

      if (!active) return;

      setResolvedProducts(mergeProductsWithLocalInventory(combinedProducts));
    };

    loadProducts();

    return () => {
      active = false;
    };
  }, [data?.products]);

  const memoizedValue = useMemo(
    () => ({
      products: resolvedProducts,
      productsLoading: isLoading && !resolvedProducts.length,
      productsError: error,
      productsValidating: isValidating,
      productsEmpty: !isLoading && !isValidating && !resolvedProducts.length,
    }),
    [error, isLoading, isValidating, resolvedProducts]
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

      setResolvedProduct(mergeProductWithLocalInventory(combinedProduct));
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
