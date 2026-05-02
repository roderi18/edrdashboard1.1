import { doc, query, where, getDoc, setDoc, getDocs, collection } from 'firebase/firestore';

import {
  ahoraTimestamp,
  COLECCIONES_COMERCIO,
  obtenerIdUsuarioComercio,
} from 'src/utils/firestore-commerce';

import { FIRESTORE, isFirebaseConfigured } from 'src/lib/firebase';
import {
  crearDocumentoOrden,
  mapearOrdenFirestoreAUi,
  mapearEstadoOrdenUiAFirestore,
} from 'src/models/order-model';

import { limpiarCarritoUsuario } from './cart-service';
import { ajustarInventarioProducto } from './inventory-service';
import { guardarSnapshotProductoFirestore } from './product-service';
import { guardarReciboFirestore, actualizarEstadoReciboFirestore } from './receipt-service';

const ordersCollection = () => collection(FIRESTORE, COLECCIONES_COMERCIO.ordenes);

export const crearOrdenFirestore = async ({ user, checkoutState, paymentData }) => {
  if (!isFirebaseConfigured || !FIRESTORE) return null;

  const baseTimestamp = Date.now();
  const orderId = `orden-${baseTimestamp}`;
  const receiptId = `recibo-${baseTimestamp}`;
  const orderRef = doc(FIRESTORE, COLECCIONES_COMERCIO.ordenes, orderId);

  const receipt = await guardarReciboFirestore({
    user,
    receiptId,
    orderId,
    checkoutState,
  });

  for (const item of checkoutState?.items || []) {
    await guardarSnapshotProductoFirestore(item);
    await ajustarInventarioProducto({
      producto: item,
      cantidadDelta: -Number(item.quantity || 0),
      tipoMovimiento: 'venta',
      motivo: 'Descuento por compra realizada',
      orderId,
      user,
    });
  }

  const orderDoc = crearDocumentoOrden({
    user,
    orderId,
    receiptId,
    checkoutState,
    paymentData,
  });

  await setDoc(orderRef, orderDoc);
  await limpiarCarritoUsuario(user);

  return {
    order: mapearOrdenFirestoreAUi({ id: orderId, ...orderDoc }),
    invoice: receipt,
  };
};

export const listarOrdenesFirestore = async () => {
  if (!isFirebaseConfigured || !FIRESTORE) return [];

  const snapshot = await getDocs(ordersCollection());
  return snapshot.docs.map((item) => mapearOrdenFirestoreAUi({ id: item.id, ...item.data() }));
};

export const listarOrdenesUsuarioFirestore = async (user) => {
  if (!isFirebaseConfigured || !FIRESTORE) return [];

  const usuarioId = obtenerIdUsuarioComercio(user);
  if (!usuarioId) return [];

  const snapshot = await getDocs(
    query(ordersCollection(), where('usuarioId', '==', usuarioId))
  );

  return snapshot.docs.map((item) => mapearOrdenFirestoreAUi({ id: item.id, ...item.data() }));
};

export const obtenerOrdenFirestorePorId = async (orderId) => {
  if (!isFirebaseConfigured || !FIRESTORE || !orderId) return null;

  const snapshot = await getDoc(doc(FIRESTORE, COLECCIONES_COMERCIO.ordenes, String(orderId)));
  if (!snapshot.exists()) return null;

  return mapearOrdenFirestoreAUi({ id: snapshot.id, ...snapshot.data() });
};

export const cambiarEstadoOrdenFirestore = async ({ orderId, nextStatus, user }) => {
  if (!isFirebaseConfigured || !FIRESTORE || !orderId) return null;

  const orderRef = doc(FIRESTORE, COLECCIONES_COMERCIO.ordenes, String(orderId));
  const snapshot = await getDoc(orderRef);
  if (!snapshot.exists()) return null;

  const currentData = snapshot.data();
  const currentStatus = currentData?.estado || 'pendiente';
  const nextStatusEs = mapearEstadoOrdenUiAFirestore(nextStatus);
  const isCancelling = currentStatus !== 'cancelada' && nextStatusEs === 'cancelada';
  const isReactivating = currentStatus === 'cancelada' && nextStatusEs !== 'cancelada';

  if (isCancelling || isReactivating) {
    for (const item of currentData?.items || []) {
      await ajustarInventarioProducto({
        producto: {
          id: item?.productoId,
          quantity: item?.cantidad,
          available: item?.cantidad,
          name: item?.nombre,
          sku: item?.sku,
          coverUrl: item?.imagenPortada,
          price: item?.precio,
          publish: 'published',
        },
        cantidadDelta: isCancelling ? Number(item?.cantidad || 0) : -Number(item?.cantidad || 0),
        tipoMovimiento: isCancelling ? 'reposicion_por_cancelacion' : 'venta',
        motivo: isCancelling
          ? 'Reposicion por cancelacion administrativa'
          : 'Reaplicacion de descuento de inventario',
        orderId,
        user,
      });
    }
  }

  const nextData = {
    ...currentData,
    estado: nextStatusEs,
    fechaActualizacion: ahoraTimestamp(),
    fechaCancelacion:
      nextStatusEs === 'cancelada' ? currentData?.fechaCancelacion || ahoraTimestamp() : null,
    canceladoPor: nextStatusEs === 'cancelada' ? obtenerIdUsuarioComercio(user) : null,
  };

  await setDoc(orderRef, nextData, { merge: true });

  if (currentData?.reciboId) {
    await actualizarEstadoReciboFirestore(
      currentData.reciboId,
      nextStatusEs === 'cancelada' ? 'cancelado' : 'pagado'
    );
  }

  return mapearOrdenFirestoreAUi({ id: snapshot.id, ...nextData });
};
