import { doc, getDoc, setDoc, deleteField } from 'firebase/firestore';

import { ahoraTimestamp } from 'src/utils/firestore-commerce';
import { conCache, conInvalidacion } from 'src/utils/cache-de-lecturas.mjs';
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

const obtenerFavoritosProductosSinCache = async (uid) => {
  if (!isFirebaseConfigured || !FIRESTORE || !uid) return new Set();

  const snapshot = await getDoc(doc(FIRESTORE, COLECCION_FAVORITOS_PRODUCTOS, String(uid)));

  return snapshot.exists() ? leerProductosFavoritos(snapshot.data()) : new Set();
};

const guardarFavoritoProductoDirecto = async ({ uid, productoId, favorito }) => {
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

// ----------------------------------------------------------------------
// CACHÉ DE LECTURAS (`src/utils/cache-de-lecturas.mjs`): lo leído se reparte
// desde la memoria de la pestaña y cada escritura lo invalida. Antes cada
// visita a la pantalla volvía a pedirlo todo. Vive solo en memoria: se pierde
// al cerrar la aplicación, también lo sensible (salud, tutores).
// ----------------------------------------------------------------------

export const obtenerFavoritosProductos = conCache('tienda-favoritos:obtenerFavoritosProductos', obtenerFavoritosProductosSinCache);
export const guardarFavoritoProducto = conInvalidacion(guardarFavoritoProductoDirecto, [], ['tienda-favoritos:']);
