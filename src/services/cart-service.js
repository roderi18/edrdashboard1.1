import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';

import { conCache, conInvalidacion } from 'src/utils/cache-de-lecturas.mjs';
import { COLECCIONES_COMERCIO, obtenerIdUsuarioComercio } from 'src/utils/firestore-commerce';

import { FIRESTORE, isFirebaseConfigured } from 'src/lib/firebase';
import { CARRITO_DEFAULT, crearDocumentoCarrito, mapearCarritoFirestoreAEstado } from 'src/models/cart-model';

const obtenerCarritoUsuarioSinCache = async (user) => {
  if (!isFirebaseConfigured || !FIRESTORE) {
    return { ...CARRITO_DEFAULT };
  }

  const usuarioId = obtenerIdUsuarioComercio(user);
  if (!usuarioId) return { ...CARRITO_DEFAULT };

  const cartRef = doc(FIRESTORE, COLECCIONES_COMERCIO.carritos, usuarioId);
  const snapshot = await getDoc(cartRef);

  if (!snapshot.exists()) {
    const cartDoc = crearDocumentoCarrito({ user, state: {} });
    await setDoc(cartRef, cartDoc);
    return mapearCarritoFirestoreAEstado(cartDoc);
  }

  return mapearCarritoFirestoreAEstado(snapshot.data());
};

const guardarCarritoUsuarioDirecto = async ({ user, state }) => {
  if (!isFirebaseConfigured || !FIRESTORE) {
    return mapearCarritoFirestoreAEstado(crearDocumentoCarrito({ user, state }));
  }

  const usuarioId = obtenerIdUsuarioComercio(user);
  if (!usuarioId) {
    return mapearCarritoFirestoreAEstado(crearDocumentoCarrito({ user, state }));
  }

  const cartRef = doc(FIRESTORE, COLECCIONES_COMERCIO.carritos, usuarioId);
  const previous = await getDoc(cartRef);
  const cartDoc = crearDocumentoCarrito({
    user,
    state,
    createdAt: previous.exists() ? previous.data()?.fechaCreacion : null,
  });

  await setDoc(cartRef, cartDoc);

  return mapearCarritoFirestoreAEstado(cartDoc);
};

const limpiarCarritoUsuarioDirecto = async (user) => {
  if (!isFirebaseConfigured || !FIRESTORE) {
    return { ...CARRITO_DEFAULT };
  }

  const usuarioId = obtenerIdUsuarioComercio(user);
  if (!usuarioId) return { ...CARRITO_DEFAULT };

  const cartRef = doc(FIRESTORE, COLECCIONES_COMERCIO.carritos, usuarioId);
  const emptyCart = crearDocumentoCarrito({ user, state: {} });

  await setDoc(cartRef, emptyCart);

  return mapearCarritoFirestoreAEstado(emptyCart);
};

const eliminarCarritoUsuarioDirecto = async (user) => {
  if (!isFirebaseConfigured || !FIRESTORE) return;

  const usuarioId = obtenerIdUsuarioComercio(user);
  if (!usuarioId) return;

  const cartRef = doc(FIRESTORE, COLECCIONES_COMERCIO.carritos, usuarioId);
  await deleteDoc(cartRef);
};

// ----------------------------------------------------------------------
// CACHÉ DE LECTURAS (`src/utils/cache-de-lecturas.mjs`): lo leído se reparte
// desde la memoria de la pestaña y cada escritura lo invalida. Antes cada
// visita a la pantalla volvía a pedirlo todo. Vive solo en memoria: se pierde
// al cerrar la aplicación, también lo sensible (salud, tutores).
// ----------------------------------------------------------------------

export const obtenerCarritoUsuario = conCache('carrito:obtenerCarritoUsuario', obtenerCarritoUsuarioSinCache);
export const guardarCarritoUsuario = conInvalidacion(guardarCarritoUsuarioDirecto, ['carrito:']);
export const limpiarCarritoUsuario = conInvalidacion(limpiarCarritoUsuarioDirecto, ['carrito:']);
export const eliminarCarritoUsuario = conInvalidacion(eliminarCarritoUsuarioDirecto, ['carrito:']);
