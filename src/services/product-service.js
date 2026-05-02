import {
  doc,
  getDoc,
  setDoc,
  getDocs,
  deleteDoc,
  collection,
} from 'firebase/firestore';

import { COLECCIONES_COMERCIO } from 'src/utils/firestore-commerce';
import { uploadOptimizedImages } from 'src/utils/firebase-image-storage';

import { FIRESTORE, isFirebaseConfigured } from 'src/lib/firebase';
import { crearDocumentoProducto, mapearProductoFirestoreAUi } from 'src/models/product-model';

const isStoredImageValue = (image) =>
  typeof image === 'string' && /^(https?:|data:|blob:)/i.test(image);

const getProductCreatedAtTime = (product) => {
  const value = product?.createdAt;
  const timestamp = value ? new Date(value).getTime() : 0;

  return Number.isNaN(timestamp) ? 0 : timestamp;
};

export const listarProductosFirestore = async () => {
  if (!isFirebaseConfigured || !FIRESTORE) return [];

  const snapshot = await getDocs(collection(FIRESTORE, COLECCIONES_COMERCIO.productos));
  return snapshot.docs.map((item) => mapearProductoFirestoreAUi({ id: item.id, ...item.data() }));
};

export const combinarProductosConFirestore = ({
  productosRemotos = [],
  productosFirestore = [],
} = {}) => {
  const productosFirestorePorId = new Map(
    (productosFirestore || [])
      .filter((product) => product?.id)
      .map((product) => [String(product.id), product])
  );

  const productosCombinados = (productosRemotos || []).map((product) => {
    const firestoreProduct = productosFirestorePorId.get(String(product.id));

    if (!firestoreProduct) {
      return product;
    }

    productosFirestorePorId.delete(String(product.id));

    return {
      ...product,
      ...firestoreProduct,
      id: String(product.id),
      createdAt: firestoreProduct.createdAt || product.createdAt,
      images:
        Array.isArray(firestoreProduct.images) && firestoreProduct.images.length
          ? firestoreProduct.images
          : product.images || [],
      coverUrl: firestoreProduct.coverUrl || product.coverUrl || '',
    };
  });

  return [...productosCombinados, ...productosFirestorePorId.values()].sort(
    (a, b) => getProductCreatedAtTime(b) - getProductCreatedAtTime(a)
  );
};

export const listarProductosCombinados = async (productosRemotos = []) => {
  const firestoreProducts = await listarProductosFirestore();
  return combinarProductosConFirestore({
    productosRemotos,
    productosFirestore: firestoreProducts,
  });
};

export const obtenerProductoFirestorePorId = async (productId) => {
  if (!isFirebaseConfigured || !FIRESTORE || !productId) return null;

  const snapshot = await getDoc(doc(FIRESTORE, COLECCIONES_COMERCIO.productos, String(productId)));
  if (!snapshot.exists()) return null;

  return mapearProductoFirestoreAUi({ id: snapshot.id, ...snapshot.data() });
};

export const resolverProductoCombinadoPorId = async ({ productId, productoRemoto = null } = {}) => {
  const firestoreProduct = await obtenerProductoFirestorePorId(productId);

  if (firestoreProduct && productoRemoto) {
    return combinarProductosConFirestore({
      productosRemotos: [productoRemoto],
      productosFirestore: [firestoreProduct],
    })[0];
  }

  return firestoreProduct || productoRemoto || null;
};

export const guardarProductoFirestore = async (data, { publish = true } = {}) => {
  if (!isFirebaseConfigured || !FIRESTORE) return null;

  const productId = data?.id || `local-product-${Date.now()}`;
  const productRef = doc(FIRESTORE, COLECCIONES_COMERCIO.productos, String(productId));
  const previous = await getDoc(productRef);
  const previousProduct = previous.exists()
    ? mapearProductoFirestoreAUi({ id: productId, ...previous.data() })
    : null;
  const inputImages = Array.isArray(data?.images) ? data.images : [];
  const storedImages = inputImages.filter(isStoredImageValue);
  const fileImages = inputImages.filter((image) => image instanceof File);
  const uploadedImagesResult = fileImages.length
    ? await uploadOptimizedImages({
        files: fileImages,
        preset: 'producto',
        storagePathBuilder: (file, index) =>
          `productos/${productId}/imagen-${Date.now()}-${index}.webp`,
        metadataBuilder: (file, index) => ({
          tipoEntidad: 'producto',
          productoId: String(productId),
          indice: String(index),
        }),
      })
    : { uploads: [], summary: null };
  const images = [
    ...storedImages,
    ...uploadedImagesResult.uploads.map((image) => image.downloadUrl),
  ].filter(Boolean);
  const finalImages = images.length ? images : previousProduct?.images || [];
  const productDoc = crearDocumentoProducto({
    productoId: String(productId),
    data: {
      ...data,
      images: finalImages,
      coverUrl: finalImages[0] || data?.coverUrl || previousProduct?.coverUrl || '',
    },
    publicacion: publish ? 'publicado' : 'borrador',
    fechaCreacion: previous.exists() ? previous.data()?.fechaCreacion : null,
  });

  await setDoc(productRef, productDoc);

  return {
    product: mapearProductoFirestoreAUi({ id: productId, ...productDoc }),
    imageStats: uploadedImagesResult.summary,
  };
};

export const guardarSnapshotProductoFirestore = async (product) => {
  if (!isFirebaseConfigured || !FIRESTORE || !product?.id) return null;

  const productRef = doc(FIRESTORE, COLECCIONES_COMERCIO.productos, String(product.id));
  const previous = await getDoc(productRef);
  const productDoc = crearDocumentoProducto({
    productoId: String(product.id),
    data: product,
    publicacion: product?.publish === 'published' ? 'publicado' : 'borrador',
    fechaCreacion: previous.exists() ? previous.data()?.fechaCreacion : null,
  });

  await setDoc(productRef, productDoc, { merge: true });

  return mapearProductoFirestoreAUi({ id: product.id, ...productDoc });
};

export const actualizarPublicacionProductoFirestore = async (productId, publish) => {
  if (!isFirebaseConfigured || !FIRESTORE || !productId) return null;

  const productRef = doc(FIRESTORE, COLECCIONES_COMERCIO.productos, String(productId));
  const snapshot = await getDoc(productRef);

  if (!snapshot.exists()) return null;

  const currentDoc = snapshot.data();
  const nextDoc = crearDocumentoProducto({
    productoId: String(productId),
    data: {
      ...mapearProductoFirestoreAUi({ id: productId, ...currentDoc }),
      ...currentDoc,
    },
    publicacion: publish === 'published' ? 'publicado' : 'borrador',
    fechaCreacion: currentDoc?.fechaCreacion ?? null,
  });

  await setDoc(productRef, nextDoc, { merge: true });

  return mapearProductoFirestoreAUi({ id: productId, ...nextDoc });
};

export const eliminarProductoFirestore = async (productId) => {
  if (!isFirebaseConfigured || !FIRESTORE || !productId) return;

  await deleteDoc(doc(FIRESTORE, COLECCIONES_COMERCIO.productos, String(productId)));
};
