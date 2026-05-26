import { doc, query, where, getDoc, setDoc, getDocs, collection } from 'firebase/firestore';

import { COLECCIONES_COMERCIO, obtenerIdUsuarioComercio } from 'src/utils/firestore-commerce';

import { FIRESTORE, isFirebaseConfigured } from 'src/lib/firebase';
import {
  crearDocumentoRecibo,
  mapearReciboFirestoreAUi,
  mapearEstadoReciboUiAFirestore,
} from 'src/models/receipt-model';

import { registrarAuditoriaSilenciosa } from './audit-log-service';
import {
  crearNotificacionFacturaGenerada,
  crearNotificacionFacturaDisponible,
} from './notification-service';

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

  const receipt = mapearReciboFirestoreAUi({ id: currentReceiptId, ...receiptDoc });

  if (!previous.exists()) {
    registrarAuditoriaSilenciosa({
      modulo: 'facturas',
      accion: 'factura_creada',
      descripcion: `Factura ${receiptDoc.numeroRecibo || currentReceiptId} creada.`,
      entidad: {
        tipo: 'factura',
        id: currentReceiptId,
        nombre: receiptDoc.numeroRecibo || currentReceiptId,
        ruta: `/dashboard/invoice/${currentReceiptId}`,
      },
      despues: receiptDoc,
      realizadoPor: user,
      metadatos: {
        orderId,
      },
    });

    crearNotificacionFacturaGenerada({ factura: receipt, usuario: user }).catch((error) => {
      console.error('[receipt service] no se pudo notificar factura generada', error);
    });
    crearNotificacionFacturaDisponible({ factura: receipt, usuario: user }).catch((error) => {
      console.error('[receipt service] no se pudo notificar factura disponible', error);
    });
  }

  return receipt;
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

export const actualizarEstadoReciboFirestore = async (receiptId, estado, user = {}) => {
  if (!isFirebaseConfigured || !FIRESTORE || !receiptId) return null;

  const receiptRef = doc(FIRESTORE, COLECCIONES_COMERCIO.recibos, String(receiptId));
  const snapshot = await getDoc(receiptRef);
  if (!snapshot.exists()) return null;

  const nextDoc = {
    ...snapshot.data(),
    estado: mapearEstadoReciboUiAFirestore(estado),
  };

  await setDoc(receiptRef, nextDoc, { merge: true });

  registrarAuditoriaSilenciosa({
    modulo: 'facturas',
    accion: 'factura_estado_actualizado',
    descripcion: `Estado de la factura ${nextDoc.numeroRecibo || receiptId} actualizado a ${nextDoc.estado}.`,
    entidad: {
      tipo: 'factura',
      id: snapshot.id,
      nombre: nextDoc.numeroRecibo || snapshot.id,
      ruta: `/dashboard/invoice/${snapshot.id}`,
    },
    antes: {
      estado: snapshot.data()?.estado,
    },
    despues: {
      estado: nextDoc.estado,
    },
    realizadoPor: user,
  });

  return mapearReciboFirestoreAUi({ id: snapshot.id, ...nextDoc });
};

export const actualizarReciboFirestore = async (receiptId, data = {}, user = {}) => {
  if (!isFirebaseConfigured || !FIRESTORE || !receiptId) return null;

  const receiptRef = doc(FIRESTORE, COLECCIONES_COMERCIO.recibos, String(receiptId));
  const snapshot = await getDoc(receiptRef);
  if (!snapshot.exists()) return null;

  const currentDoc = snapshot.data();
  const nextDoc = {
    ...currentDoc,
    numeroRecibo: data.invoiceNumber || currentDoc.numeroRecibo,
    estado: mapearEstadoReciboUiAFirestore(data.status),
    impuestos: Number(data.taxes ?? 0),
    descuento: Number(data.discount ?? 0),
    envio: Number(data.shipping ?? 0),
    subtotal: Number(data.subtotal ?? 0),
    montoTotal: Number(data.totalAmount ?? 0),
    emitidoPor: {
      nombre: data.invoiceFrom?.name || currentDoc.emitidoPor?.nombre || '',
      direccionCompleta:
        data.invoiceFrom?.fullAddress || currentDoc.emitidoPor?.direccionCompleta || '',
      telefono: data.invoiceFrom?.phoneNumber || currentDoc.emitidoPor?.telefono || '',
    },
    emitidoPara: {
      nombre: data.invoiceTo?.name || currentDoc.emitidoPara?.nombre || '',
      direccionCompleta:
        data.invoiceTo?.fullAddress || currentDoc.emitidoPara?.direccionCompleta || '',
      telefono: data.invoiceTo?.phoneNumber || currentDoc.emitidoPara?.telefono || '',
      correo: data.invoiceTo?.company || data.invoiceTo?.email || currentDoc.emitidoPara?.correo || '',
      codigoMiembro:
        data.invoiceTo?.codigoMiembro || currentDoc.emitidoPara?.codigoMiembro || null,
    },
    items: (data.items || []).map((item) => ({
      productoId: String(item.id || item.productoId || ''),
      nombre: item.title || item.name || 'Producto',
      descripcion: item.description || '',
      precio: Number(item.price ?? 0),
      cantidad: Number(item.quantity ?? 0),
      total: Number(item.total ?? 0),
    })),
  };

  await setDoc(receiptRef, nextDoc, { merge: true });

  const receipt = mapearReciboFirestoreAUi({ id: snapshot.id, ...nextDoc });

  registrarAuditoriaSilenciosa({
    modulo: 'facturas',
    accion: 'factura_actualizada',
    descripcion: `Factura ${nextDoc.numeroRecibo || receiptId} actualizada.`,
    severidad: 'importante',
    entidad: {
      tipo: 'factura',
      id: snapshot.id,
      nombre: nextDoc.numeroRecibo || snapshot.id,
      ruta: `/dashboard/invoice/${snapshot.id}`,
    },
    antes: currentDoc,
    despues: nextDoc,
    realizadoPor: user,
  });

  crearNotificacionFacturaGenerada({ factura: receipt, usuario: user }).catch((error) => {
    console.error('[receipt service] no se pudo notificar factura generada', error);
  });
  crearNotificacionFacturaDisponible({ factura: receipt, usuario: user }).catch((error) => {
    console.error('[receipt service] no se pudo notificar factura disponible', error);
  });

  return receipt;
};
