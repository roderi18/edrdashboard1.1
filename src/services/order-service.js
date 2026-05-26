import {
  doc,
  query,
  where,
  getDoc,
  setDoc,
  getDocs,
  collection,
  serverTimestamp,
} from 'firebase/firestore';

import { uploadFilesToStorage, buildStorageFileName } from 'src/utils/firebase-file-storage';
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
import {
  crearNotificacionesPedidoCreado,
  crearNotificacionEvaluacionPedido,
  crearNotificacionPedidoCanceladoAdmin,
  crearNotificacionArchivosFaltantesPedido,
} from './notification-service';

const ordersCollection = () => collection(FIRESTORE, COLECCIONES_COMERCIO.ordenes);
const COLECCION_CONVERSACIONES_CHAT = 'conversaciones_chat';
const SUBCOLECCION_MENSAJES_CHAT = 'mensajes';
const REMITENTE_TIENDA_ID_MIEMBROS = -900001;

const nowIso = () => new Date().toISOString();

const itemRequiereEvaluacion = (item = {}) =>
  Boolean(
    item?.requiereAprobacion ||
    item?.aprobacion?.requerida ||
    String(item?.renglon || '').toLowerCase() === 'restringido' ||
    String(item?.tipoProducto || '').toLowerCase() === 'restringido'
  );

const ordenRequiereEvaluacion = (order = {}) =>
  Boolean(order?.requiereEvaluacion || (order?.items || []).some(itemRequiereEvaluacion));

const checkoutRequiereEvaluacion = (checkoutState = {}) =>
  (checkoutState?.items || []).some(itemRequiereEvaluacion);

const subirComprobantePagoOrden = async ({ orderId, user = {}, file }) => {
  if (!file) {
    return null;
  }

  const [uploadedFile] = await uploadFilesToStorage({
    files: [file],
    storagePathBuilder: (finalFile, index) =>
      `ordenes/${orderId}/comprobantes-pago/${buildStorageFileName(finalFile, index)}`,
    metadataBuilder: () => ({
      orderId,
      userId: obtenerIdUsuarioComercio(user) || '',
      tipoArchivo: 'comprobante_pago',
    }),
  });

  return uploadedFile
    ? {
        ...uploadedFile,
        origen: 'comprobante_pago',
      }
    : null;
};

const toNumberOrNull = (value) => {
  const number = Number(value);

  return Number.isFinite(number) && number !== 0 ? number : null;
};

const splitCustomerName = (name = '') => {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);

  return {
    nombres: parts.slice(0, Math.max(1, parts.length - 1)).join(' ') || name || 'Miembro',
    apellidos: parts.length > 1 ? parts.slice(-1).join(' ') : '',
  };
};

const construirParticipanteCliente = (orden = {}) => {
  const idMiembros = toNumberOrNull(orden?.miembroId);

  if (!idMiembros) {
    return null;
  }

  return {
    idMiembros,
    codigoMiembro: orden?.cliente?.codigoMiembro || '',
    ...splitCustomerName(orden?.cliente?.nombre || ''),
    correo: orden?.cliente?.correo || '',
    telefono: orden?.cliente?.telefono || '',
    estatusMiembro: orden?.cliente?.rolMiembro || 'usuario',
    avatarUrl: '',
  };
};

const construirParticipanteTienda = () => ({
  idMiembros: REMITENTE_TIENDA_ID_MIEMBROS,
  codigoMiembro: 'TIENDA',
  nombres: 'Tienda',
  apellidos: 'Virtual',
  correo: '',
  telefono: '',
  estatusMiembro: 'sistema',
  avatarUrl: '',
});

const crearMensajeChatEvaluacionPedido = async ({ orden = {}, texto = '' }) => {
  const cliente = construirParticipanteCliente(orden);

  if (!cliente || !texto) {
    return null;
  }

  const tienda = construirParticipanteTienda();
  const participantes = [tienda, cliente];
  const participantesIds = participantes.map((participant) => participant.idMiembros);
  const idConversacion = `individual_${[...participantesIds].sort((a, b) => a - b).join('_')}`;
  const enviadoEn = nowIso();
  const idMensaje = `pedido_${orden?.ordenId || Date.now()}_${Date.now()}`;
  const conversationRef = doc(FIRESTORE, COLECCION_CONVERSACIONES_CHAT, idConversacion);
  const conversationSnapshot = await getDoc(conversationRef);
  const conversationData = conversationSnapshot.exists() ? conversationSnapshot.data() : {};
  const noLeidosPorIdMiembros = {
    [String(REMITENTE_TIENDA_ID_MIEMBROS)]: 0,
    [String(cliente.idMiembros)]:
      Number(conversationData?.noLeidosPorIdMiembros?.[String(cliente.idMiembros)] || 0) + 1,
  };
  const messageDoc = {
    idMensaje,
    texto,
    tipoContenido: 'text',
    remitenteIdMiembros: REMITENTE_TIENDA_ID_MIEMBROS,
    remitente: tienda,
    adjuntos: [],
    metadatos: {
      ordenId: orden?.ordenId || orden?.id || null,
      numeroOrden: orden?.numeroOrden || orden?.orderNumber || null,
    },
    enviadoEn,
    actualizadoEn: enviadoEn,
    editado: false,
    eliminado: false,
    eliminadoEn: null,
    vistoPorIdMiembros: {},
  };

  await setDoc(
    conversationRef,
    {
      idConversacion,
      tipoConversacion: 'INDIVIDUAL',
      participantesIds,
      participantes,
      creadoPorIdMiembros:
        conversationData?.creadoPorIdMiembros || REMITENTE_TIENDA_ID_MIEMBROS,
      creadoEn: conversationData?.creadoEn || enviadoEn,
      actualizadoEn: enviadoEn,
      ultimoMensaje: {
        idMensaje,
        texto,
        tipoContenido: 'text',
        remitenteIdMiembros: REMITENTE_TIENDA_ID_MIEMBROS,
        enviadoEn,
      },
      noLeidosPorIdMiembros,
      activa: true,
      eliminada: false,
      actualizadoEnServidor: serverTimestamp(),
    },
    { merge: true }
  );

  await setDoc(
    doc(conversationRef, SUBCOLECCION_MENSAJES_CHAT, idMensaje),
    {
      ...messageDoc,
      creadoEnServidor: serverTimestamp(),
      actualizadoEnServidor: serverTimestamp(),
    },
    { merge: true }
  );

  return { idConversacion, idMensaje };
};

const actualizarItemsEvaluacion = ({ items = [], estado, razon = '', user = {} }) =>
  items.map((item) => {
    const requiereEvaluacion =
      item?.requiereAprobacion ||
      item?.renglon === 'restringido' ||
      item?.tipoProducto === 'restringido';

    if (!requiereEvaluacion) {
      return item;
    }

    return {
      ...item,
      aprobacion: {
        ...(item?.aprobacion || {}),
        requerida: true,
        estado,
        aprobadoPor:
          estado === 'aprobada' ? obtenerIdUsuarioComercio(user) : item?.aprobacion?.aprobadoPor,
        fechaAprobacion: estado === 'aprobada' ? ahoraTimestamp() : item?.aprobacion?.fechaAprobacion,
        comentario: razon || item?.aprobacion?.comentario || null,
        archivosAdjuntos: item?.archivosAdjuntos || item?.aprobacion?.archivosAdjuntos || [],
      },
    };
  });

export const crearOrdenFirestore = async ({ user, checkoutState, paymentData }) => {
  if (!isFirebaseConfigured || !FIRESTORE) return null;

  const baseTimestamp = Date.now();
  const orderId = `orden-${baseTimestamp}`;
  const receiptId = `recibo-${baseTimestamp}`;
  const orderRef = doc(FIRESTORE, COLECCIONES_COMERCIO.ordenes, orderId);
  const requiereEvaluacion = checkoutRequiereEvaluacion(checkoutState);
  const { comprobanteTransferencia, ...paymentDataSinArchivo } = paymentData || {};
  const comprobantePago = await subirComprobantePagoOrden({
    orderId,
    user,
    file: comprobanteTransferencia,
  });

  const receipt = await guardarReciboFirestore({
    user,
    receiptId,
    orderId,
    checkoutState,
  });

  for (const item of checkoutState?.items || []) {
    await guardarSnapshotProductoFirestore(item);

    if (!requiereEvaluacion) {
      await ajustarInventarioProducto({
        producto: item,
        cantidadDelta: -Number(item.quantity || 0),
        tipoMovimiento: 'venta',
        motivo: 'Descuento por compra realizada',
        orderId,
        user,
      });
    }
  }

  const orderDoc = crearDocumentoOrden({
    user,
    orderId,
    receiptId,
    checkoutState,
    paymentData: {
      ...paymentDataSinArchivo,
      comprobantePago,
    },
  });

  await setDoc(orderRef, orderDoc);
  await limpiarCarritoUsuario(user);

  try {
    await crearNotificacionesPedidoCreado({
      orden: orderDoc,
      usuario: user,
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('notificaciones:actualizar'));
    }
  } catch (notificationError) {
    console.error('[order service] no se pudieron crear notificaciones del pedido', notificationError);
  }

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
  if (!snapshot.exists()) {
    const byNumberSnapshot = await getDocs(
      query(ordersCollection(), where('numeroOrden', '==', String(orderId)))
    );

    if (byNumberSnapshot.empty) return null;

    const orderSnapshot = byNumberSnapshot.docs[0];

    return mapearOrdenFirestoreAUi({ id: orderSnapshot.id, ...orderSnapshot.data() });
  }

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
  const inventarioFueDescontado = !ordenRequiereEvaluacion(currentData);

  if (inventarioFueDescontado && (isCancelling || isReactivating)) {
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

  if (isCancelling) {
    try {
      await crearNotificacionPedidoCanceladoAdmin({
        orden: { id: snapshot.id, ...nextData },
        razon: 'Cancelacion administrativa',
        usuario: user,
      });
    } catch (notificationError) {
      console.error('[order service] no se pudo notificar la cancelacion', notificationError);
    }
  }

  if (currentData?.reciboId) {
    await actualizarEstadoReciboFirestore(
      currentData.reciboId,
      nextStatusEs === 'cancelada' ? 'cancelado' : 'pagado'
    );
  }

  return mapearOrdenFirestoreAUi({ id: snapshot.id, ...nextData });
};

export const evaluarOrdenRestringidaFirestore = async ({
  orderId,
  accion,
  razon = '',
  user,
}) => {
  if (!isFirebaseConfigured || !FIRESTORE || !orderId) return null;

  const orderRef = doc(FIRESTORE, COLECCIONES_COMERCIO.ordenes, String(orderId));
  const snapshot = await getDoc(orderRef);
  if (!snapshot.exists()) return null;

  const currentData = snapshot.data();
  const estadoEvaluacion =
    accion === 'aceptar' ? 'aprobada' : accion === 'rechazar' ? 'rechazada' : 'en_evaluacion';
  const timelineItem = {
    titulo:
      accion === 'aceptar'
        ? 'Orden aceptada'
        : accion === 'rechazar'
          ? 'Orden rechazada'
          : 'Orden en evaluación',
    descripcion:
      accion === 'rechazar'
        ? `Motivo del rechazo: ${razon}`
        : 'Evaluación de producto restringido actualizada.',
    fecha: ahoraTimestamp(),
    usuarioId: obtenerIdUsuarioComercio(user),
    rol: 'admin',
  };
  const nextData = {
    ...currentData,
    items: actualizarItemsEvaluacion({
      items: currentData?.items || [],
      estado: estadoEvaluacion,
      razon,
      user,
    }),
    fechaActualizacion: ahoraTimestamp(),
    historial: {
      ...(currentData?.historial || {}),
      lineaDeTiempo: [...(currentData?.historial?.lineaDeTiempo || []), timelineItem],
    },
  };

  await setDoc(orderRef, nextData, { merge: true });

  let updatedData = nextData;

  if (accion === 'rechazar') {
    const cancelledOrder = await cambiarEstadoOrdenFirestore({
      orderId,
      nextStatus: 'cancelled',
      user,
    });

    updatedData = {
      ...nextData,
      estado: 'cancelada',
      fechaCancelacion: ahoraTimestamp(),
      canceladoPor: obtenerIdUsuarioComercio(user),
    };

    if (cancelledOrder) {
      updatedData = {
        ...updatedData,
        estado: 'cancelada',
      };
    }

    const chatMessage = await crearMensajeChatEvaluacionPedido({
      orden: updatedData,
      texto: `Tu pedido ${updatedData.numeroOrden} fue rechazado. Motivo: ${razon}.\n\nPresiona este número de orden para cargar el archivo faltante.`,
    });

    await crearNotificacionEvaluacionPedido({
      orden: updatedData,
      tipo: 'rechazada',
      razon,
      usuario: user,
      metadatosExtra: chatMessage || {},
    });

    await crearNotificacionPedidoCanceladoAdmin({
      orden: updatedData,
      razon,
      usuario: user,
    });
  }

  if (accion === 'aceptar') {
    const chatMessage = await crearMensajeChatEvaluacionPedido({
      orden: updatedData,
      texto: `Tu pedido ${updatedData.numeroOrden} fue aprobado para compra.`,
    });

    await crearNotificacionEvaluacionPedido({
      orden: updatedData,
      tipo: 'aceptada',
      usuario: user,
      metadatosExtra: chatMessage || {},
    });
  }

  return mapearOrdenFirestoreAUi({ id: snapshot.id, ...updatedData });
};

export const cargarArchivosFaltantesOrdenFirestore = async ({
  orderId,
  archivos = [],
  user,
}) => {
  if (!isFirebaseConfigured || !FIRESTORE || !orderId || !archivos.length) return null;

  const orderRef = doc(FIRESTORE, COLECCIONES_COMERCIO.ordenes, String(orderId));
  const snapshot = await getDoc(orderRef);
  if (!snapshot.exists()) return null;

  const currentData = snapshot.data();
  const fechaCarga = ahoraTimestamp();
  let archivosAsignados = false;

  const items = (currentData?.items || []).map((item) => {
    if (archivosAsignados || !itemRequiereEvaluacion(item)) {
      return item;
    }

    archivosAsignados = true;
    const currentAttachments = item?.archivosAdjuntos || [];
    const currentApprovalAttachments = item?.aprobacion?.archivosAdjuntos || currentAttachments;
    const missingFiles = archivos.map((file) => ({
      ...file,
      tipoAdjunto: 'faltante_rechazo',
      cargadoPor: obtenerIdUsuarioComercio(user),
      fechaCargaFaltante: fechaCarga,
    }));

    return {
      ...item,
      archivosAdjuntos: [...currentAttachments, ...missingFiles],
      aprobacion: {
        ...(item?.aprobacion || {}),
        estado: 'pendiente',
        archivosAdjuntos: [...currentApprovalAttachments, ...missingFiles],
        archivosFaltantes: [...(item?.aprobacion?.archivosFaltantes || []), ...missingFiles],
        fechaCargaFaltantes: fechaCarga,
      },
    };
  });

  const nextData = {
    ...currentData,
    estado: 'pendiente',
    items,
    fechaActualizacion: fechaCarga,
    historial: {
      ...(currentData?.historial || {}),
      lineaDeTiempo: [
        ...(currentData?.historial?.lineaDeTiempo || []),
        {
          titulo: 'Archivos faltantes cargados',
          descripcion: 'El miembro cargó archivos faltantes para reevaluación.',
          fecha: fechaCarga,
          usuarioId: obtenerIdUsuarioComercio(user),
        },
      ],
    },
  };

  await setDoc(orderRef, nextData, { merge: true });

  try {
    await crearNotificacionArchivosFaltantesPedido({
      orden: nextData,
      archivos,
      usuario: user,
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('notificaciones:actualizar'));
    }
  } catch (notificationError) {
    console.error(
      '[order service] no se pudo notificar la carga de archivos faltantes',
      notificationError
    );
  }

  return mapearOrdenFirestoreAUi({ id: snapshot.id, ...nextData });
};

const getAttachmentIdentity = (file = {}) =>
  [file.id, file.storagePath, file.url, file.downloadURL, file.nombre].filter(Boolean).join('|');

const sameAttachment = (currentFile = {}, targetFile = {}) => {
  const currentIdentity = getAttachmentIdentity(currentFile);
  const targetIdentity = getAttachmentIdentity(targetFile);

  if (currentIdentity && targetIdentity && currentIdentity === targetIdentity) {
    return true;
  }

  return Boolean(
    targetFile?.storagePath && currentFile?.storagePath === targetFile.storagePath
  );
};

const removeAttachmentFromArray = (files = [], targetFile = {}) =>
  files.filter((file) => !sameAttachment(file, targetFile));

const appendAttachmentToArray = (files = [], targetFile = {}) => {
  if (files.some((file) => sameAttachment(file, targetFile))) {
    return files;
  }

  return [...files, targetFile];
};

const actualizarArchivoAdjuntoOrdenFirestore = async ({
  orderId,
  archivo = {},
  user,
  action = 'remove',
}) => {
  if (!isFirebaseConfigured || !FIRESTORE || !orderId || !archivo) return null;

  const orderRef = doc(FIRESTORE, COLECCIONES_COMERCIO.ordenes, String(orderId));
  const snapshot = await getDoc(orderRef);
  if (!snapshot.exists()) return null;

  const currentData = snapshot.data();
  const targetProductId = String(archivo.productId || archivo.productoId || '');
  let archivoProcesado = false;

  const updateFiles = (files = [], targetFile = archivo) =>
    action === 'restore'
      ? appendAttachmentToArray(files, targetFile)
      : removeAttachmentFromArray(files, targetFile);

  const items = (currentData?.items || []).map((item) => {
    const isTargetProduct = !targetProductId || String(item?.productoId || '') === targetProductId;
    const hasFile =
      (item?.archivosAdjuntos || []).some((file) => sameAttachment(file, archivo)) ||
      (item?.aprobacion?.archivosAdjuntos || []).some((file) => sameAttachment(file, archivo)) ||
      (item?.aprobacion?.archivosFaltantes || []).some((file) => sameAttachment(file, archivo));

    if (archivoProcesado || !isTargetProduct || (action !== 'restore' && !hasFile)) {
      return item;
    }

    archivoProcesado = true;
    const approval = item?.aprobacion || {};
    const restoredFile = {
      ...archivo,
      restauradoPor: action === 'restore' ? obtenerIdUsuarioComercio(user) : archivo.restauradoPor,
      fechaRestauracion: action === 'restore' ? ahoraTimestamp() : archivo.fechaRestauracion,
    };
    const nextFile = action === 'restore' ? restoredFile : archivo;
    const currentMissingFiles = approval.archivosFaltantes || [];

    return {
      ...item,
      archivosAdjuntos: updateFiles(item?.archivosAdjuntos || [], nextFile),
      aprobacion: {
        ...approval,
        archivosAdjuntos: updateFiles(
          approval.archivosAdjuntos || item?.archivosAdjuntos || [],
          nextFile
        ),
        archivosFaltantes:
          nextFile.tipoAdjunto === 'faltante_rechazo'
            ? updateFiles(currentMissingFiles, nextFile)
            : currentMissingFiles,
      },
    };
  });

  const nextData = {
    ...currentData,
    items,
    fechaActualizacion: ahoraTimestamp(),
    historial:
      action === 'remove'
        ? {
          ...(currentData?.historial || {}),
          lineaDeTiempo: [
            ...(currentData?.historial?.lineaDeTiempo || []),
            {
              titulo: 'Archivo adjunto eliminado',
              descripcion: `Administrador eliminó el archivo ${archivo?.nombre || 'sin nombre'}.`,
              fecha: ahoraTimestamp(),
              usuarioId: obtenerIdUsuarioComercio(user),
              rol: 'admin',
            },
          ],
        }
        : currentData?.historial,
  };

  await setDoc(orderRef, nextData, { merge: true });

  return mapearOrdenFirestoreAUi({ id: snapshot.id, ...nextData });
};

export const eliminarArchivoAdjuntoOrdenFirestore = ({ orderId, archivo, user }) =>
  actualizarArchivoAdjuntoOrdenFirestore({ orderId, archivo, user, action: 'remove' });

export const restaurarArchivoAdjuntoOrdenFirestore = ({ orderId, archivo, user }) =>
  actualizarArchivoAdjuntoOrdenFirestore({ orderId, archivo, user, action: 'restore' });
