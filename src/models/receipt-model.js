import { fVariantDescription, fReceiptItemDescription } from 'src/utils/format-color';
import {
  ahoraTimestamp,
  TEXTO_SIN_TELEFONO,
  TEXTO_SIN_DIRECCION,
  timestampToIsoString,
  sanitizarFirestoreData,
  obtenerIdMiembroComercio,
  obtenerIdUsuarioComercio,
  construirDireccionCompleta,
} from 'src/utils/firestore-commerce';

export const RECIBO_DEFAULT = {
  reciboId: '',
  numeroRecibo: '',
  ordenId: '',
  usuarioId: '',
  miembroId: null,
  estado: 'pagado',
  emitidoPor: {
    nombre: 'Exploradores del Rey',
    direccionCompleta: 'Tienda Virtual, Rep. Dom.',
    telefono: TEXTO_SIN_TELEFONO,
  },
  emitidoPara: {
    nombre: '',
    direccionCompleta: '',
    telefono: '',
    correo: '',
    codigoMiembro: null,
  },
  items: [],
  subtotal: 0,
  descuento: 0,
  envio: 0,
  impuestos: 0,
  montoTotal: 0,
  urlPdf: null,
  fechaCreacion: null,
  fechaActualizacion: null,
};

const EMAIL_DOMINIO_MIEMBROS = '@exploradores.app';

const normalizeText = (value) => String(value ?? '').trim();

const hasRealValue = (value, placeholder = '') => {
  const normalizedValue = normalizeText(value).toLowerCase();
  const normalizedPlaceholder = normalizeText(placeholder).toLowerCase();

  if (!normalizedValue) {
    return false;
  }

  return !normalizedPlaceholder || normalizedValue !== normalizedPlaceholder;
};

// UNA COMPRA, UN NUMERO.
//
// El pedido y su recibo son dos documentos —`ordenes` y `recibos`, atados por
// `ordenId`— pero para quien compra son la MISMA compra: el numero que ve al
// pagar tiene que ser el que luego encuentra en su lista de pedidos. Con dos
// numeros distintos, y los dos empezando por "REC-", no habia forma de saber
// cual pedir por telefono.
//
// El de abajo se queda de reserva: recibos viejos que se vuelven a guardar y no
// traen numero de pedido.
const buildReceiptNumber = ({ createdAt }) => {
  const date = createdAt?.toDate?.() ?? new Date(createdAt ?? Date.now());
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;

  const dd = String(safeDate.getDate()).padStart(2, '0');
  const mm = String(safeDate.getMonth() + 1).padStart(2, '0');
  const yyyy = safeDate.getFullYear();
  const hh = String(safeDate.getHours()).padStart(2, '0');
  const min = String(safeDate.getMinutes()).padStart(2, '0');
  const ss = String(safeDate.getSeconds()).padStart(2, '0');

  return `REC-${dd}${mm}${yyyy}-${hh}${min}${ss}`;
};

const resolveRealEmail = (user = {}, checkoutState = {}) => {
  const apiEmail = normalizeText(user?.correo || checkoutState?.billing?.correo || checkoutState?.billing?.email);

  if (apiEmail) {
    return apiEmail;
  }

  const authEmail = normalizeText(user?.email);

  if (!authEmail || authEmail.toLowerCase().endsWith(EMAIL_DOMINIO_MIEMBROS)) {
    return '';
  }

  return authEmail;
};

const resolveBillingAddress = (billing = {}) => {
  const directAddress = [
    billing?.fullAddress,
    billing?.direccionCompleta,
    billing?.address,
    billing?.direccion,
  ].find((value) => hasRealValue(value, TEXTO_SIN_DIRECCION));

  if (directAddress) {
    return normalizeText(directAddress);
  }

  return construirDireccionCompleta({
    provincia: billing?.province || billing?.provincia,
    municipio: billing?.city || billing?.municipio,
    sector: billing?.sector,
    calle: billing?.street || billing?.calle || billing?.line1,
  });
};

const resolveBillingPhone = (billing = {}) => {
  const phone = billing?.phoneNumber || billing?.telefono || billing?.phone || '';
  return hasRealValue(phone, TEXTO_SIN_TELEFONO) ? normalizeText(phone) : '';
};

// UN NUMERO YA ESCRITO NO SE VUELVE A INVENTAR.
//
// Esto solo aceptaba los que empezaban por "REC-", asi que en cuanto el recibo
// paso a llevar el numero de su orden —"ORD-26-0001"— lo tiraba y pintaba uno
// nuevo por fecha: el documento decia una cosa y la pantalla otra. Lo que se
// genera aqui es el ULTIMO recurso, para recibos que nunca tuvieron numero.
const normalizeReceiptNumber = ({ numeroRecibo, fechaCreacion }) => {
  const currentNumber = normalizeText(numeroRecibo);

  if (currentNumber) {
    return currentNumber;
  }

  return buildReceiptNumber({ createdAt: fechaCreacion });
};

export const mapearEstadoReciboUiAFirestore = (status = '') => {
  if (status === 'pending') return 'pendiente';
  if (status === 'overdue') return 'vencido';
  if (status === 'draft') return 'borrador';
  if (status === 'cancelled') return 'cancelado';
  return 'pagado';
};

export const mapearEstadoReciboFirestoreAUi = (status = '') => {
  if (status === 'pendiente') return 'pending';
  if (status === 'vencido') return 'overdue';
  if (status === 'borrador') return 'draft';
  if (status === 'cancelado') return 'cancelled';
  return 'paid';
};

export const crearDocumentoRecibo = ({
  user,
  receiptId,
  orderId,
  // El numero de SU pedido: una compra, un numero.
  numeroOrden,
  // La del recibo que ya existia, cuando se vuelve a guardar.
  fechaCreacion = null,
  checkoutState = {},
} = {}) => {
  // UN RECIBO SE EMITE UNA VEZ. Quien lo guarda otra vez —al cambiarle el
  // estado, por ejemplo— no lo esta emitiendo de nuevo: `guardarReciboFirestore`
  // ya leia la fecha anterior y la pasaba, pero aqui no se recogia y cada
  // guardado la movia a hoy.
  const createdAt = fechaCreacion ?? ahoraTimestamp();
  const subtotal = Number(checkoutState?.subtotal ?? 0);
  const descuento = Number(checkoutState?.discount ?? 0);
  const envio = Number(checkoutState?.shipping ?? 0);
  const codigoMiembro = user?.codigoMiembro || user?.memberId || null;
  const correoReal = resolveRealEmail(user, checkoutState);
  const direccionCompleta = resolveBillingAddress(checkoutState?.billing);
  const telefono = resolveBillingPhone(checkoutState?.billing);
  const items = Array.isArray(checkoutState?.items)
    ? checkoutState.items.map((item) => ({
      productoId: String(item?.id ?? ''),
      nombre: item?.name ?? '',
      descripcion: fVariantDescription(item?.size, item?.colors?.[0]) || 'Compra Firestore',
      precio: Number(item?.price ?? 0),
      cantidad: Number(item?.quantity ?? 0),
      total:
        Number(item?.subtotal ?? 0) || Number(item?.price ?? 0) * Number(item?.quantity ?? 0),
    }))
    : [];
  const requiereEvaluacion = Array.isArray(checkoutState?.items)
    ? checkoutState.items.some(
        (item) =>
          item?.requiereAprobacion ||
          item?.renglon === 'restringido' ||
          item?.tipoProducto === 'restringido'
      )
    : false;

  return sanitizarFirestoreData({
    ...RECIBO_DEFAULT,
    reciboId: receiptId,
    numeroRecibo: normalizeText(numeroOrden) || buildReceiptNumber({ createdAt }),
    ordenId: orderId,
    usuarioId: obtenerIdUsuarioComercio(user) || '',
    miembroId: obtenerIdMiembroComercio(user),
    estado: requiereEvaluacion ? 'pendiente' : 'pagado',
    emitidoPor: {
      nombre: 'Exploradores del Rey',
      direccionCompleta: 'Tienda Virtual, Rep. Dom.',
      telefono: TEXTO_SIN_TELEFONO,
    },
    emitidoPara: {
      nombre: user?.displayName || user?.nombre || checkoutState?.billing?.name || 'Cliente',
      direccionCompleta,
      telefono,
      correo: correoReal,
      codigoMiembro,
    },
    items,
    subtotal,
    descuento,
    envio,
    impuestos: 0,
    montoTotal: subtotal - descuento + envio,
    urlPdf: null,
    fechaCreacion: createdAt,
    fechaActualizacion: createdAt,
  });
};

export const mapearReciboFirestoreAUi = (doc = {}) => ({
  id: doc?.reciboId,
  taxes: Number(doc?.impuestos ?? 0),
  status: mapearEstadoReciboFirestoreAUi(doc?.estado),
  discount: Number(doc?.descuento ?? 0),
  shipping: Number(doc?.envio ?? 0),
  subtotal: Number(doc?.subtotal ?? 0),
  totalAmount: Number(doc?.montoTotal ?? 0),
  items: (doc?.items || []).map((item) => ({
    id: item?.productoId,
    title: item?.nombre,
    description: fReceiptItemDescription(item?.descripcion),
    price: Number(item?.precio ?? 0),
    service: 'Technology',
    quantity: Number(item?.cantidad ?? 0),
    total: Number(item?.total ?? 0),
  })),
  invoiceNumber: normalizeReceiptNumber({
    numeroRecibo: doc?.numeroRecibo,
    fechaCreacion: doc?.fechaCreacion,
  }),
  invoiceFrom: {
    name: doc?.emitidoPor?.nombre || 'Exploradores del Rey',
    fullAddress: doc?.emitidoPor?.direccionCompleta || 'Tienda Virtual, Rep. Dom.',
    phoneNumber: doc?.emitidoPor?.telefono || TEXTO_SIN_TELEFONO,
  },
  invoiceTo: {
    name: doc?.emitidoPara?.nombre || '',
    fullAddress: doc?.emitidoPara?.direccionCompleta || TEXTO_SIN_DIRECCION,
    phoneNumber: doc?.emitidoPara?.telefono || TEXTO_SIN_TELEFONO,
    company: doc?.emitidoPara?.correo || '',
    codigoMiembro: doc?.emitidoPara?.codigoMiembro || null,
    memberId: doc?.miembroId || null,
    idMiembros: doc?.miembroId || null,
  },
  sent: 1,
  createDate: timestampToIsoString(doc?.fechaCreacion),
  dueDate: timestampToIsoString(doc?.fechaCreacion),
  orderId: doc?.ordenId || null,
  pdfUrl: doc?.urlPdf || null,
});
