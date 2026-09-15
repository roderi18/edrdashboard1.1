import { doc, getDoc, setDoc, deleteField } from 'firebase/firestore';

import { ahoraTimestamp } from 'src/utils/firestore-commerce';
import {
  leerProductosFavoritos,
  COLECCION_FAVORITOS_PRODUCTOS,
} from 'src/utils/producto-favorito-compartir.mjs';

import { FIRESTORE, isFirebaseConfigured } from 'src/lib/firebase';

// ----------------------------------------------------------------------
// LOS FAVORITOS DE LA TIENDA, por persona.
//
// Un documento por uid con un mapa `productos` ({ idProducto: true }). Se usa el
// uid y no el numero de miembro porque en la tienda tambien compra quien no
// tiene ficha de miembro, y porque la regla lo compara con `request.auth.uid`.
// ----------------------------------------------------------------------

export const obtenerFavoritosProductos = async (uid) => {
  if (!isFirebaseConfigured || !FIRESTORE || !uid) return new Set();

  const snapshot = await getDoc(doc(FIRESTORE, COLECCION_FAVORITOS_PRODUCTOS, String(uid)));

  return snapshot.exists() ? leerProductosFavoritos(snapshot.data()) : new Set();
};

export const guardarFavoritoProducto = async ({ uid, productoId, favorito }) => {
  if (!isFirebaseConfigured || !FIRESTORE || !uid || !productoId) return;

  // `merge` con `deleteField`: quitar uno no pisa los demas favoritos de la
  // persona, y el mapa no acumula entradas en `false`.
  await setDoc(
    doc(FIRESTORE, COLECCION_FAVORITOS_PRODUCTOS, String(uid)),
    {
      uid: String(uid),
      productos: { [String(productoId)]: favorito ? true : deleteField() },
      fechaActualizacion: ahoraTimestamp(),
    },
    { merge: true }
  );
};
