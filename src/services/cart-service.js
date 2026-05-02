import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';

import { FIRESTORE, isFirebaseConfigured } from 'src/lib/firebase';

import { COLECCIONES_COMERCIO, obtenerIdUsuarioComercio } from 'src/utils/firestore-commerce';
import { CARRITO_DEFAULT, crearDocumentoCarrito, mapearCarritoFirestoreAEstado } from 'src/models/cart-model';

export const obtenerCarritoUsuario = async (user) => {
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

export const guardarCarritoUsuario = async ({ user, state }) => {
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

export const limpiarCarritoUsuario = async (user) => {
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

export const eliminarCarritoUsuario = async (user) => {
  if (!isFirebaseConfigured || !FIRESTORE) return;

  const usuarioId = obtenerIdUsuarioComercio(user);
  if (!usuarioId) return;

  const cartRef = doc(FIRESTORE, COLECCIONES_COMERCIO.carritos, usuarioId);
  await deleteDoc(cartRef);
};
