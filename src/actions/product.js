import useSWR from 'swr';
import { useMemo, useState, useEffect } from 'react';

import { valorGuardado, invalidarLecturas } from 'src/utils/cache-de-lecturas.mjs';

import { fetcher, endpoints } from 'src/lib/axios';
import { useLecturasVivas } from 'src/lib/avisos-de-lecturas';
import {
  CANAL_DE_PRODUCTOS,
  listarProductosFirestore,
  resolverProductoCombinadoPorId,
} from 'src/services/product-service';

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
  // UN PRECIO CAMBIADO SE VE AL MOMENTO. El precio de un combo se edita en la
  // tienda o en el Designer, y se lee en la portada, "Inscribirme" y el carrito:
  // sin releer, cada pantalla abierta seguía con el de antes. Otros equipos
  // avisan por la caché; este navegador (pestañas e iframes), por su canal.
  const cambiosEnOtrasSesiones = useLecturasVivas(['tienda-productos:']);
  const [cambiosEnEsteNavegador, setCambiosEnEsteNavegador] = useState(0);

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return undefined;

    const canal = new BroadcastChannel(CANAL_DE_PRODUCTOS);

    canal.onmessage = () => {
      invalidarLecturas('tienda-productos:');
      setCambiosEnEsteNavegador((actual) => actual + 1);
    };

    return () => canal.close();
  }, []);

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

        // Al releer tras un aviso, un fallo no borra lo que ya se pintaba.
        setProductsError(loadError);
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
  }, [cambiosEnOtrasSesiones, cambiosEnEsteNavegador]);

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
