import { doc, addDoc, collection, runTransaction } from 'firebase/firestore';

import { COLECCIONES_COMERCIO, obtenerIdUsuarioComercio } from 'src/utils/firestore-commerce';

import { FIRESTORE, isFirebaseConfigured } from 'src/lib/firebase';
import { crearDocumentoMovimientoInventario } from 'src/models/inventory-movement-model';
import { crearDocumentoProducto, mapearProductoFirestoreAUi } from 'src/models/product-model';

const mapInventoryTypeEs = (available) => {
  const currentAvailable = Number(available) || 0;

  if (currentAvailable <= 0) return 'sin existencias';
  if (currentAvailable <= 10) return 'pocas existencias';
  return 'en existencia';
};

export const ajustarInventarioProducto = async ({
  producto,
  cantidadDelta,
  tipoMovimiento,
  motivo,
  ordenId = null,
  user = null,
} = {}) => {
  if (!isFirebaseConfigured || !FIRESTORE || !producto?.id) return null;

  const productRef = doc(FIRESTORE, COLECCIONES_COMERCIO.productos, String(producto.id));
  const userId = obtenerIdUsuarioComercio(user);

  const result = await runTransaction(FIRESTORE, async (transaction) => {
    const productSnapshot = await transaction.get(productRef);
    const baseData = productSnapshot.exists()
      ? productSnapshot.data()
      : crearDocumentoProducto({
          productoId: String(producto.id),
          data: producto,
          publicacion: producto?.publish === 'draft' ? 'borrador' : 'publicado',
        });

    const previousAvailable = Number(
      productSnapshot.exists() ? baseData?.disponibles : producto?.available ?? baseData?.disponibles
    ) || 0;
    const nextAvailable = Math.max(0, previousAvailable + Number(cantidadDelta || 0));
    const nextProductDoc = {
      ...baseData,
      productoId: String(producto.id),
      disponibles: nextAvailable,
      cantidad: Number(baseData?.cantidad ?? producto?.quantity ?? nextAvailable),
      tipoInventario: mapInventoryTypeEs(nextAvailable),
    };

    transaction.set(productRef, nextProductDoc, { merge: true });

    return {
      previousAvailable,
      nextAvailable,
      productDoc: nextProductDoc,
    };
  });

  const movementDoc = crearDocumentoMovimientoInventario({
    productoId: producto.id,
    ordenId,
    tipoMovimiento,
    cantidad: Math.abs(Number(cantidadDelta || 0)),
    disponiblesAntes: result.previousAvailable,
    disponiblesDespues: result.nextAvailable,
    motivo,
    creadoPor: userId,
  });

  await addDoc(
    collection(FIRESTORE, COLECCIONES_COMERCIO.movimientosInventario),
    movementDoc
  );

  return mapearProductoFirestoreAUi({ id: producto.id, ...result.productDoc });
};
