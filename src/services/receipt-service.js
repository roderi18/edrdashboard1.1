import { doc, query, where, getDoc, setDoc, getDocs, collection } from 'firebase/firestore';

import { COLECCIONES_COMERCIO, obtenerIdUsuarioComercio } from 'src/utils/firestore-commerce';

import { FIRESTORE, isFirebaseConfigured } from 'src/lib/firebase';
import {
  crearDocumentoRecibo,
  mapearReciboFirestoreAUi,
  mapearEstadoReciboUiAFirestore,
} from 'src/models/receipt-model';

const receiptsCollection = () => collection(FIRESTORE, COLECCIONES_COMERCIO.recibos);

export const guardarReciboFirestore = async ({ user, receiptId, orderId, checkoutState }) => {
  if (!isFirebaseConfigured || !FIRESTORE) return null;

  const currentReceiptId = receiptId || `recibo-${Date.now()}`;
  const receiptRef = doc(FIRESTORE, COLECCIONES_COMERCIO.recibos, currentReceiptId);
  const previous = await getDoc(receiptRef);
  const receiptDoc = crearDocumentoRecibo({
    user,
    receiptId: currentReceiptId,
    orderId,
    checkoutState,
    fechaCreacion: previous.exists() ? previous.data()?.fechaCreacion : null,
  });

  await setDoc(receiptRef, receiptDoc);

  return mapearReciboFirestoreAUi({ id: currentReceiptId, ...receiptDoc });
};

export const listarRecibosFirestore = async () => {
  if (!isFirebaseConfigured || !FIRESTORE) return [];

  const snapshot = await getDocs(receiptsCollection());
  return snapshot.docs.map((item) => mapearReciboFirestoreAUi({ id: item.id, ...item.data() }));
};

export const obtenerReciboFirestorePorId = async (receiptId) => {
  if (!isFirebaseConfigured || !FIRESTORE || !receiptId) return null;

  const snapshot = await getDoc(doc(FIRESTORE, COLECCIONES_COMERCIO.recibos, String(receiptId)));
  if (!snapshot.exists()) return null;

  return mapearReciboFirestoreAUi({ id: snapshot.id, ...snapshot.data() });
};

export const listarRecibosUsuarioFirestore = async (user) => {
  if (!isFirebaseConfigured || !FIRESTORE) return [];

  const usuarioId = obtenerIdUsuarioComercio(user);
  if (!usuarioId) return [];

  const snapshot = await getDocs(
    query(receiptsCollection(), where('usuarioId', '==', usuarioId))
  );

  return snapshot.docs.map((item) => mapearReciboFirestoreAUi({ id: item.id, ...item.data() }));
};

export const actualizarEstadoReciboFirestore = async (receiptId, estado) => {
  if (!isFirebaseConfigured || !FIRESTORE || !receiptId) return null;

  const receiptRef = doc(FIRESTORE, COLECCIONES_COMERCIO.recibos, String(receiptId));
  const snapshot = await getDoc(receiptRef);
  if (!snapshot.exists()) return null;

  const nextDoc = {
    ...snapshot.data(),
    estado: mapearEstadoReciboUiAFirestore(estado),
  };

  await setDoc(receiptRef, nextDoc, { merge: true });

  return mapearReciboFirestoreAUi({ id: snapshot.id, ...nextDoc });
};
