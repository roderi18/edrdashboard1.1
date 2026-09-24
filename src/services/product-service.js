import {
  doc,
  getDoc,
  setDoc,
  getDocs,
  deleteDoc,
  collection,
  runTransaction,
} from 'firebase/firestore';

import { COLECCIONES_COMERCIO } from 'src/utils/firestore-commerce';
import { miniaturaDesdeArchivo } from 'src/utils/miniatura-buscador';
import { uploadOptimizedImages } from 'src/utils/firebase-image-storage';
import { conCache, conInvalidacion } from 'src/utils/cache-de-lecturas.mjs';
import {
  aplicarResumenResenas,
  agruparResumenPorProducto,
} from 'src/utils/resumen-resenas-producto.mjs';
import {
  formatearCodigoProducto,
  prefijoDeCategoriaProducto,
  siguienteNumeroCodigoProducto,
} from 'src/utils/producto-codigo.mjs';

import { FIRESTORE, isFirebaseConfigured } from 'src/lib/firebase';
import { AMBITOS_CAMBIO, proponerCambio } from 'src/services/solicitudes-cambio-service';
import { crearDocumentoProducto, mapearProductoFirestoreAUi } from 'src/models/product-model';

import { registrarAuditoriaSilenciosa } from './audit-log-service';
import { guardarProductoEnIndice } from './buscador-indice-service';
import {
  crearNotificacionProductoSinStock,
  crearNotificacionProductoPublicado,
  crearNotificacionProductoStockBajo,
  crearNotificacionErrorSubidaArchivoImagen,
  crearNotificacionProductoDisponibleNuevamente,
} from './notification-service';

const isStoredImageValue = (image) =>
  typeof image === 'string' && /^(https?:|data:|blob:)/i.test(image);

const COLECCION_RESERVAS_CODIGOS = 'reservas_codigos_productos';

const normalizarCodigoProducto = (codigo) => String(codigo || '').trim().toUpperCase();

/**
 * Reserva el codigo que propone el formulario o, si ya lo tomo otra ventana,
 * el siguiente codigo libre. La reserva es una transaccion separada porque dos
 * formularios abiertos pueden leer exactamente la misma lista antes de guardar.
 */
const reservarCodigoProducto = async ({
  productId,
  codigoSolicitado,
  categoria,
  etiqueta,
} = {}) => {
  const snapshot = await getDocs(collection(FIRESTORE, COLECCIONES_COMERCIO.productos));
  const codigoActual = normalizarCodigoProducto(codigoSolicitado);
  const productos = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
  const codigosUsados = new Set(
    productos
      .filter((producto) => String(producto.productoId || producto.id) !== String(productId))
      .map((producto) => normalizarCodigoProducto(producto.codigo))
      .filter(Boolean)
  );
  const prefijo = prefijoDeCategoriaProducto(categoria, etiqueta);
  const siguienteNumero = siguienteNumeroCodigoProducto(
    prefijo,
    productos.map((producto) => producto.codigo)
  );
  const candidatos = [];

  if (codigoActual && !codigosUsados.has(codigoActual)) candidatos.push(codigoActual);

  for (let numero = siguienteNumero; candidatos.length < 100; numero += 1) {
    const candidato = formatearCodigoProducto(prefijo, numero);
    if (!codigosUsados.has(candidato) && !candidatos.includes(candidato)) {
      candidatos.push(candidato);
    }
  }

  return runTransaction(FIRESTORE, async (transaction) => {
    for (const codigo of candidatos) {
      const reservaRef = doc(FIRESTORE, COLECCION_RESERVAS_CODIGOS, codigo);
      const reserva = await transaction.get(reservaRef);
      const dueño = reserva.exists() ? String(reserva.data()?.productoId || '') : '';

      if (dueño && dueño !== String(productId)) {
        const productoDueñoRef = doc(FIRESTORE, COLECCIONES_COMERCIO.productos, dueño);
        const productoDueño = await transaction.get(productoDueñoRef);
        if (productoDueño.exists()) continue;
      }

      transaction.set(
        reservaRef,
        {
          codigo,
          productoId: String(productId),
          categoria: String(categoria || ''),
          actualizadoEn: new Date().toISOString(),
        },
        { merge: true }
      );

      return codigo;
    }

    throw new Error('No se encontró un código de producto disponible.');
  });
};

const liberarReservaCodigoProducto = async ({ productId, codigo } = {}) => {
  const codigoNormalizado = normalizarCodigoProducto(codigo);
  if (!codigoNormalizado) return;

  await runTransaction(FIRESTORE, async (transaction) => {
    const reservaRef = doc(FIRESTORE, COLECCION_RESERVAS_CODIGOS, codigoNormalizado);
    const reserva = await transaction.get(reservaRef);
    if (reserva.exists() && String(reserva.data()?.productoId || '') === String(productId)) {
      transaction.delete(reservaRef);
    }
  });
};

const getProductCreatedAtTime = (product) => {
  const value = product?.createdAt;
  const timestamp = value ? new Date(value).getTime() : 0;

  return Number.isNaN(timestamp) ? 0 : timestamp;
};

const listarProductosFirestoreSinCache = async () => {
  if (!isFirebaseConfigured || !FIRESTORE) return [];

  // Las resenas se leen junto a los productos: el resumen guardado en cada
  // producto se quedaba en 0 y la lista enseñaba sin estrellas a productos que
  // si las tenian. Si fallan, se queda el resumen guardado antes que nada.
  const [snapshot, snapshotResenas] = await Promise.all([
    getDocs(collection(FIRESTORE, COLECCIONES_COMERCIO.productos)),
    getDocs(collection(FIRESTORE, COLECCIONES_COMERCIO.resenasProductos)).catch((error) => {
      console.error('[product service] no se pudieron leer las resenas', error);
      return null;
    }),
  ]);
  const productos = snapshot.docs.map((item) =>
    mapearProductoFirestoreAUi({ id: item.id, ...item.data() })
  );

  if (!snapshotResenas) return productos;

  return aplicarResumenResenas(
    productos,
    agruparResumenPorProducto(snapshotResenas.docs.map((item) => ({ id: item.id, ...item.data() })))
  );
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

const obtenerProductoFirestorePorIdSinCache = async (productId) => {
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

const guardarProductoFirestoreDirecto = async (data, { publish = true, user = {} } = {}) => {
  if (!isFirebaseConfigured || !FIRESTORE) return null;

  const productId = data?.id || `producto-${Date.now()}`;
  const productRef = doc(FIRESTORE, COLECCIONES_COMERCIO.productos, String(productId));
  const previous = await getDoc(productRef);
  const previousProduct = previous.exists()
    ? mapearProductoFirestoreAUi({ id: productId, ...previous.data() })
    : null;
  const inputImages = Array.isArray(data?.images) ? data.images : [];
  const storedImages = inputImages.filter(isStoredImageValue);
  const fileImages = inputImages.filter((image) => image instanceof File);
  let uploadedImagesResult = { uploads: [], summary: null };

  try {
    uploadedImagesResult = fileImages.length
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
  } catch (error) {
    await crearNotificacionErrorSubidaArchivoImagen({
      archivo: fileImages[0],
      error,
      contexto: 'producto',
      usuario: user,
    }).catch((notificationError) => {
      console.error('[product service] no se pudo notificar error de imagen', notificationError);
    });
    throw error;
  }
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

  const codigoAnterior = normalizarCodigoProducto(previousProduct?.code || previousProduct?.codigo);
  let codigoReservado = '';

  try {
    codigoReservado = await reservarCodigoProducto({
      productId,
      codigoSolicitado: productDoc.codigo,
      categoria: productDoc.categoria,
      etiqueta: productDoc.categoria,
    });
    productDoc.codigo = codigoReservado;
  } catch (error) {
    throw new Error(`No se pudo validar el código del producto: ${error?.message || error}`);
  }

  // El resumen de resenas no es del formulario: lo escribe quien publica una
  // resena. Tomarlo del formulario lo dejaba en 0 en cada guardado del producto.
  if (previous.exists()) {
    productDoc.totalCalificaciones = Number(previous.data()?.totalCalificaciones ?? 0);
    productDoc.totalResenas = Number(previous.data()?.totalResenas ?? 0);
  }

  // La tienda tambien entra por la puerta: no necesita aprobacion de la Oficina
  // Nacional —la gestiona su administrador— pero cada cambio queda en Historial.
  try {
    await proponerCambio({
      ambito: AMBITOS_CAMBIO.tienda,
      entidad: {
        tipo: 'producto',
        id: productId,
        nombre: productDoc?.nombre || productDoc?.titulo || productId,
        ruta: `/dashboard/product/${productId}`,
      },
      cambios: [
        {
          campo: 'codigo',
          etiqueta: 'Código del producto',
          antes: codigoAnterior || null,
          despues: productDoc.codigo,
        },
        {
          campo: 'publicacion',
          etiqueta: 'Publicación',
          antes: previous.exists() ? (previous.data()?.publicacion ?? null) : null,
          despues: productDoc.publicacion,
        },
      ],
      usuario: user,
      descripcion: `Producto ${productDoc?.nombre || productDoc?.titulo || productId} guardado.`,
      aplicar: () => setDoc(productRef, productDoc),
    });
  } catch (error) {
    await liberarReservaCodigoProducto({ productId, codigo: codigoReservado }).catch(
      (releaseError) => console.error('[product service] no se pudo liberar la reserva de codigo', releaseError)
    );
    throw error;
  }

  const savedProduct = mapearProductoFirestoreAUi({ id: productId, ...productDoc });

  // EL BUSCADOR DE LA CABECERA, AL DIA.
  //
  // Se apunta el nombre y una miniatura de unos 2 kB. La miniatura se saca del
  // archivo que se acaba de subir —aqui lo tenemos en la mano, sin descargar
  // nada— y solo cuando hay imagen nueva: al editar el precio de un producto, la
  // que ya habia en el indice se queda.
  //
  // Va DESPUES de guardar y sin bloquear: si el indice falla, el producto ya
  // esta publicado y lo unico que pasa es que sale sin foto al buscarlo.
  miniaturaDesdeArchivo(fileImages[0])
    .catch(() => '')
    .then((miniatura) =>
      guardarProductoEnIndice({
        id: productId,
        nombre: productDoc.nombre,
        codigo: productDoc.codigo,
        categoria: productDoc.categoria,
        ...(miniatura ? { miniatura } : {}),
      })
    )
    .catch((error) => {
      console.warn('[buscador] no se pudo indexar el producto', error?.message ?? error);
    });

  registrarAuditoriaSilenciosa({
    modulo: 'productos',
    accion: previous.exists() ? 'producto_actualizado' : 'producto_creado',
    descripcion: `Producto ${savedProduct.name || savedProduct.title || productId} guardado.`,
    severidad: publish ? 'importante' : 'informativa',
    entidad: {
      tipo: 'producto',
      id: productId,
      nombre: savedProduct.name || savedProduct.title || productId,
      ruta: `/dashboard/product/${productId}`,
    },
    antes: previousProduct,
    despues: savedProduct,
    realizadoPor: user,
    metadatos: {
      publicacion: productDoc.publicacion,
      imagenesSubidas: uploadedImagesResult.summary?.uploadedCount || 0,
    },
  });

  const previousWasPublished =
    previousProduct?.publish === 'published' || previousProduct?.publicacion === 'publicado';
  const isPublished = savedProduct?.publish === 'published' || productDoc?.publicacion === 'publicado';

  if (publish && isPublished && !previousWasPublished) {
    crearNotificacionProductoPublicado({ producto: savedProduct, usuario: user }).catch((error) => {
      console.error('[product service] no se pudo notificar producto publicado', error);
    });
  }

  const disponibles = Number(savedProduct?.available ?? productDoc?.disponibles ?? 0);
  const previousAvailable = Number(previousProduct?.available ?? previousProduct?.disponibles ?? 0);

  if (previous.exists() && previousAvailable <= 0 && disponibles > 0) {
    crearNotificacionProductoDisponibleNuevamente({ producto: savedProduct, usuario: user }).catch((error) => {
      console.error('[product service] no se pudo notificar producto disponible nuevamente', error);
    });
  } else if (disponibles <= 0) {
    crearNotificacionProductoSinStock({ producto: savedProduct, usuario: user }).catch((error) => {
      console.error('[product service] no se pudo notificar producto sin stock', error);
    });
  } else if (disponibles <= 10) {
    crearNotificacionProductoStockBajo({ producto: savedProduct, usuario: user }).catch((error) => {
      console.error('[product service] no se pudo notificar stock bajo', error);
    });
  }

  return {
    product: savedProduct,
    imageStats: uploadedImagesResult.summary,
  };
};

const guardarSnapshotProductoFirestoreDirecto = async (product) => {
  if (!isFirebaseConfigured || !FIRESTORE || !product?.id) return null;

  const productRef = doc(FIRESTORE, COLECCIONES_COMERCIO.productos, String(product.id));
  const previous = await getDoc(productRef);
  if (previous.exists()) {
    return mapearProductoFirestoreAUi({ id: product.id, ...previous.data() });
  }

  const selectedQuantity = Number(product?.quantity ?? product?.cantidad ?? 0);
  const availableQuantity = Number(product?.available ?? product?.disponibles ?? 0);
  const productData = {
    ...product,
    quantity: Math.max(selectedQuantity, availableQuantity),
  };
  const productDoc = crearDocumentoProducto({
    productoId: String(product.id),
    data: productData,
    publicacion: product?.publish === 'draft' ? 'borrador' : 'publicado',
  });

  await setDoc(productRef, productDoc);

  return mapearProductoFirestoreAUi({ id: product.id, ...productDoc });
};

const actualizarPublicacionProductoFirestoreDirecto = async (productId, publish, user = {}) => {
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

  const updatedProduct = mapearProductoFirestoreAUi({ id: productId, ...nextDoc });

  registrarAuditoriaSilenciosa({
    modulo: 'productos',
    accion: 'producto_publicacion_actualizada',
    descripcion: `Publicación del producto ${updatedProduct.name || updatedProduct.title || productId} actualizada.`,
    severidad: 'importante',
    entidad: {
      tipo: 'producto',
      id: productId,
      nombre: updatedProduct.name || updatedProduct.title || productId,
      ruta: `/dashboard/product/${productId}`,
    },
    antes: {
      publicacion: currentDoc?.publicacion,
    },
    despues: {
      publicacion: nextDoc?.publicacion,
    },
    realizadoPor: user,
  });

  if (publish === 'published') {
    crearNotificacionProductoPublicado({ producto: updatedProduct, usuario: user }).catch((error) => {
      console.error('[product service] no se pudo notificar producto publicado', error);
    });
  }

  return updatedProduct;
};

const eliminarProductoFirestoreDirecto = async (productId, user = {}) => {
  if (!isFirebaseConfigured || !FIRESTORE || !productId) return;

  const productRef = doc(FIRESTORE, COLECCIONES_COMERCIO.productos, String(productId));
  const previous = await getDoc(productRef);

  await deleteDoc(productRef);

  registrarAuditoriaSilenciosa({
    modulo: 'productos',
    accion: 'producto_eliminado',
    descripcion: `Producto ${productId} eliminado.`,
    severidad: 'importante',
    entidad: {
      tipo: 'producto',
      id: productId,
      nombre: previous.exists() ? previous.data()?.nombre || productId : productId,
      ruta: '/dashboard/product',
    },
    antes: previous.exists() ? previous.data() : null,
    realizadoPor: user,
  });
};

// ----------------------------------------------------------------------
// CACHÉ DE LECTURAS (`src/utils/cache-de-lecturas.mjs`): lo leído se reparte
// desde la memoria de la pestaña y cada escritura lo invalida. Antes cada
// visita a la pantalla volvía a pedirlo todo. Vive solo en memoria: se pierde
// al cerrar la aplicación, también lo sensible (salud, tutores).
// ----------------------------------------------------------------------

export const listarProductosFirestore = conCache('tienda-productos:listarProductosFirestore', listarProductosFirestoreSinCache);
export const obtenerProductoFirestorePorId = conCache('tienda-productos:obtenerProductoFirestorePorId', obtenerProductoFirestorePorIdSinCache);
export const guardarProductoFirestore = conInvalidacion(guardarProductoFirestoreDirecto, [], ['tienda-productos:']);
export const guardarSnapshotProductoFirestore = conInvalidacion(guardarSnapshotProductoFirestoreDirecto, [], ['tienda-productos:']);
export const actualizarPublicacionProductoFirestore = conInvalidacion(actualizarPublicacionProductoFirestoreDirecto, [], ['tienda-productos:']);
export const eliminarProductoFirestore = conInvalidacion(eliminarProductoFirestoreDirecto, [], ['tienda-productos:']);
