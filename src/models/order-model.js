import {
  ahoraTimestamp,
  timestampToIsoString,
  sanitizarFirestoreData,
  normalizarTextoFirestore,
  obtenerIdMiembroComercio,
  obtenerIdUsuarioComercio,
} from 'src/utils/firestore-commerce';

export const ORDEN_DEFAULT = {
  ordenId: '',
  numeroOrden: '',
  usuarioId: '',
  miembroId: null,
  cliente: {
    nombre: '',
    correo: '',
    telefono: '',
    codigoMiembro: null,
    rolMiembro: null,
    destacamentoId: null,
    nombreDestacamento: null,
  },
  items: [],
  subtotal: 0,
  descuento: 0,
  envio: 0,
  impuestos: 0,
  montoTotal: 0,
  cantidadTotal: 0,
  estado: 'pendiente',
  pago: {
    tipoPago: '',
    numeroReferencia: null,
    estadoPago: 'pendiente',
    comprobantePago: null,
  },
  direccionEnvio: null,
  direccionFacturacion: null,
  reciboId: null,
  historial: {
    fechaOrden: null,
    fechaPago: null,
    fechaEntrega: null,
    fechaCompletado: null,
    lineaDeTiempo: [],
  },
  fechaCreacion: null,
  fechaActualizacion: null,
  fechaCancelacion: null,
  canceladoPor: null,
};

export const crearItemOrden = (item = {}) => {
  const requiereAprobacion = Boolean(item?.requiereAprobacion ?? item?.renglon === 'restringido');
  const archivosAdjuntos = Array.isArray(item?.archivosAdjuntos) ? item.archivosAdjuntos : [];

  return sanitizarFirestoreData({
    productoId: String(item?.id ?? item?.productoId ?? ''),
    nombre: item?.name ?? item?.nombre ?? '',
    sku: item?.sku ?? item?.id ?? '',
    imagenPortada: item?.coverUrl ?? item?.imagenPortada ?? '',
    precio: Number(item?.price ?? item?.precio ?? 0),
    precioRegistrado: Number(item?.precioRegistrado ?? item?.registeredPrice ?? item?.price ?? 0),
    precioNoRegistrado: Number(
      item?.precioNoRegistrado ?? item?.unregisteredPrice ?? item?.price ?? 0
    ),
    cantidad: Number(item?.quantity ?? item?.cantidad ?? 0),
    subtotal:
      Number(item?.subtotal ?? 0) ||
      Number(item?.price ?? item?.precio ?? 0) * Number(item?.quantity ?? item?.cantidad ?? 0),
    color: item?.colors?.[0] ?? item?.color ?? null,
    talla: item?.size ?? item?.talla ?? null,
    renglon: item?.renglon ?? 'general',
    requiereAprobacion,
    tipoProducto: item?.tipoProducto ?? 'simple',
    variante: item?.variante ?? item?.variant ?? null,
    archivosAdjuntos,
    aprobacion: {
      requerida: requiereAprobacion,
      estado:
        item?.estadoAprobacion ?? item?.aprobacion?.estado ?? (requiereAprobacion ? 'pendiente' : 'no_requerida'),
      aprobadoPor: item?.aprobacion?.aprobadoPor ?? null,
      fechaAprobacion: item?.aprobacion?.fechaAprobacion ?? null,
      comentario: item?.aprobacion?.comentario ?? null,
      archivosAdjuntos,
    },
  });
};

export const crearDocumentoOrden = ({
  user,
  orderId,
  receiptId,
  checkoutState = {},
  paymentData = {},
} = {}) => {
  const createdAt = ahoraTimestamp();
  const subtotal = Number(checkoutState?.subtotal ?? 0);
  const descuento = Number(checkoutState?.discount ?? 0);
  const envio = Number(checkoutState?.shipping ?? 0);
  const items = Array.isArray(checkoutState?.items) ? checkoutState.items.map(crearItemOrden) : [];
  const cantidadTotal = items.reduce((acc, item) => acc + Number(item.cantidad || 0), 0);
  const usuarioId = obtenerIdUsuarioComercio(user) || '';
  const miembroId = obtenerIdMiembroComercio(user);
  const requiereEvaluacion = items.some((item) => item?.requiereAprobacion);

  return sanitizarFirestoreData({
    ...ORDEN_DEFAULT,
    ordenId: orderId,
    numeroOrden: `ORD-${Date.now()}`,
    usuarioId,
    miembroId,
    cliente: {
      nombre: user?.displayName || user?.nombre || checkoutState?.billing?.name || 'Cliente',
      correo: user?.email || user?.correo || checkoutState?.billing?.email || '',
      telefono:
        user?.phoneNumber || user?.telefono || checkoutState?.billing?.phoneNumber || '',
      codigoMiembro: user?.codigoMiembro || user?.memberId || null,
      rolMiembro: user?.memberRole || user?.role || null,
      destacamentoId: user?.idDestacamento || user?.destId || null,
      nombreDestacamento: user?.destName || null,
    },
    items,
    requiereEvaluacion,
    subtotal,
    descuento,
    envio,
    impuestos: 0,
    montoTotal: subtotal - descuento + envio,
    cantidadTotal,
    estado: 'pendiente',
    pago: {
      tipoPago: paymentData?.payment || 'efectivo',
      numeroReferencia: paymentData?.reference || null,
      estadoPago: requiereEvaluacion ? 'pendiente_evaluacion' : 'pagado',
      comprobantePago: paymentData?.comprobantePago || null,
    },
    direccionEnvio: checkoutState?.billing ?? null,
    direccionFacturacion: checkoutState?.billing ?? null,
    reciboId: receiptId,
    historial: {
      fechaOrden: createdAt,
      fechaPago: createdAt,
      fechaEntrega: null,
      fechaCompletado: null,
      lineaDeTiempo: [
        {
          titulo: requiereEvaluacion ? 'Evaluación solicitada' : 'Orden creada',
          descripcion: requiereEvaluacion
            ? 'Compra restringida registrada para evaluación'
            : 'Compra registrada en Firestore',
          fecha: createdAt,
          usuarioId,
        },
      ],
    },
    fechaCreacion: createdAt,
    fechaActualizacion: createdAt,
    fechaCancelacion: null,
    canceladoPor: null,
  });
};

export const mapearOrdenFirestoreAUi = (doc = {}) => ({
  id: doc?.ordenId,
  orderNumber: doc?.numeroOrden,
  createdAt: timestampToIsoString(doc?.fechaCreacion),
  taxes: Number(doc?.impuestos ?? 0),
  requiereEvaluacion: Boolean(
    doc?.requiereEvaluacion ||
      (doc?.items || []).some((item) => item?.requiereAprobacion || item?.renglon === 'restringido')
  ),
  items: (doc?.items || []).map((item) => ({
    id: item?.productoId,
    sku: item?.sku,
    quantity: Number(item?.cantidad ?? 0),
    name: item?.nombre,
    coverUrl: item?.imagenPortada,
    price: Number(item?.precio ?? 0),
    precioRegistrado: Number(item?.precioRegistrado ?? item?.precio ?? 0),
    precioNoRegistrado: Number(item?.precioNoRegistrado ?? item?.precio ?? 0),
    renglon: item?.renglon || 'general',
    requiereAprobacion: Boolean(item?.requiereAprobacion ?? false),
    tipoProducto: item?.tipoProducto || 'simple',
    variante: item?.variante || null,
    archivosAdjuntos: Array.isArray(item?.archivosAdjuntos) ? item.archivosAdjuntos : [],
    aprobacion: item?.aprobacion || null,
  })),
  history: {
    orderTime: timestampToIsoString(doc?.historial?.fechaOrden),
    paymentTime: timestampToIsoString(doc?.historial?.fechaPago),
    deliveryTime: timestampToIsoString(doc?.historial?.fechaEntrega),
    completionTime: timestampToIsoString(doc?.historial?.fechaCompletado),
    timeline: (doc?.historial?.lineaDeTiempo || []).map((item) => ({
      title: item?.titulo,
      description: item?.descripcion || null,
      time: timestampToIsoString(item?.fecha),
      userId: item?.usuarioId || null,
      role: item?.rol || item?.role || null,
    })),
  },
  subtotal: Number(doc?.subtotal ?? 0),
  shipping: Number(doc?.envio ?? 0),
  discount: Number(doc?.descuento ?? 0),
  customer: {
    id: doc?.usuarioId,
    memberId: doc?.miembroId,
    idMiembros: doc?.miembroId,
    codigoMiembro: doc?.cliente?.codigoMiembro || '',
    name: doc?.cliente?.nombre || 'Cliente',
    email: doc?.cliente?.correo || '',
    phoneNumber: doc?.cliente?.telefono || '',
    avatarUrl: '',
    role: doc?.cliente?.rolMiembro || '',
    memberRole: doc?.cliente?.rolMiembro || '',
    destId: doc?.cliente?.destacamentoId || null,
    destName: doc?.cliente?.nombreDestacamento || '',
  },
  delivery: {
    shipBy: 'Firestore',
    speedy: 'Normal',
    trackingNumber: doc?.ordenId,
  },
  totalAmount: Number(doc?.montoTotal ?? 0),
  totalQuantity: Number(doc?.cantidadTotal ?? 0),
  shippingAddress: {
    fullAddress: doc?.direccionEnvio?.fullAddress || doc?.direccionEnvio?.direccionCompleta || '',
    phoneNumber: doc?.direccionEnvio?.phoneNumber || doc?.direccionEnvio?.telefono || '',
  },
  payment: {
    cardType: doc?.pago?.tipoPago || '',
    cardNumber: doc?.pago?.numeroReferencia || '',
    comprobantePago: doc?.pago?.comprobantePago || null,
  },
  status:
    doc?.estado === 'cancelada'
      ? 'cancelled'
      : doc?.estado === 'completada'
        ? 'completed'
        : doc?.estado === 'reembolsada'
          ? 'refunded'
          : 'pending',
  receiptId: doc?.reciboId || null,
});

export const mapearEstadoOrdenUiAFirestore = (status = '') => {
  const normalized = normalizarTextoFirestore(status);

  if (normalized === 'cancelled') return 'cancelada';
  if (normalized === 'completed') return 'completada';
  if (normalized === 'refunded') return 'reembolsada';
  if (normalized === 'paid') return 'pagada';

  return 'pendiente';
};
