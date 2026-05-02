import {
  ahoraTimestamp,
  sanitizarFirestoreData,
  obtenerIdMiembroComercio,
  obtenerIdUsuarioComercio,
} from 'src/utils/firestore-commerce';

export const ITEM_CARRITO_DEFAULT = {
  productoId: '',
  nombre: '',
  sku: '',
  imagenPortada: '',
  precio: 0,
  cantidad: 0,
  existenciaAlAgregar: 0,
  color: null,
  talla: null,
  subtotal: 0,
};

export const CARRITO_DEFAULT = {
  usuarioId: '',
  miembroId: null,
  items: [],
  subtotal: 0,
  descuento: 0,
  envio: 0,
  total: 0,
  direccionFacturacion: null,
  totalItems: 0,
  fechaCreacion: null,
  fechaActualizacion: null,
};

export const crearItemCarrito = (item = {}) =>
  sanitizarFirestoreData({
    ...ITEM_CARRITO_DEFAULT,
    productoId: String(item?.id ?? item?.productoId ?? ''),
    nombre: item?.name ?? item?.nombre ?? '',
    sku: item?.sku ?? item?.id ?? item?.productoId ?? '',
    imagenPortada: item?.coverUrl ?? item?.imagenPortada ?? '',
    precio: Number(item?.price ?? item?.precio ?? 0),
    cantidad: Number(item?.quantity ?? item?.cantidad ?? 0),
    existenciaAlAgregar: Number(item?.available ?? item?.existenciaAlAgregar ?? 0),
    color: item?.colors?.[0] ?? item?.color ?? null,
    talla: item?.size ?? item?.talla ?? null,
    subtotal:
      Number(item?.subtotal ?? 0) ||
      Number(item?.price ?? item?.precio ?? 0) * Number(item?.quantity ?? item?.cantidad ?? 0),
  });

export const crearDocumentoCarrito = ({ user, state = {}, createdAt = null } = {}) => {
  const usuarioId = obtenerIdUsuarioComercio(user) || '';
  const miembroId = obtenerIdMiembroComercio(user);
  const items = Array.isArray(state?.items) ? state.items.map(crearItemCarrito) : [];
  const subtotal = Number(state?.subtotal ?? 0);
  const descuento = Number(state?.discount ?? state?.descuento ?? 0);
  const envio = Number(state?.shipping ?? state?.envio ?? 0);

  return sanitizarFirestoreData({
    ...CARRITO_DEFAULT,
    usuarioId,
    miembroId,
    items,
    subtotal,
    descuento,
    envio,
    total: Number(state?.total ?? subtotal - descuento + envio),
    direccionFacturacion: state?.billing ?? state?.direccionFacturacion ?? null,
    totalItems: items.reduce((acc, item) => acc + Number(item.cantidad || 0), 0),
    fechaCreacion: createdAt || ahoraTimestamp(),
    fechaActualizacion: ahoraTimestamp(),
  });
};

export const mapearCarritoFirestoreAEstado = (doc = null) => ({
  items: doc?.items?.map((item) => ({
    id: item?.productoId ?? '',
    productId: item?.productoId ?? '',
    name: item?.nombre ?? '',
    sku: item?.sku ?? '',
    coverUrl: item?.imagenPortada ?? '',
    price: Number(item?.precio ?? 0),
    quantity: Number(item?.cantidad ?? 0),
    available: Number(item?.existenciaAlAgregar ?? 0),
    colors: item?.color ? [item.color] : [],
    size: item?.talla ?? '',
    subtotal: Number(item?.subtotal ?? 0),
  })) || [],
  order: null,
  receipt: null,
  subtotal: Number(doc?.subtotal ?? 0),
  total: Number(doc?.total ?? 0),
  discount: Number(doc?.descuento ?? 0),
  shipping: Number(doc?.envio ?? 0),
  billing: doc?.direccionFacturacion ?? null,
  totalItems: Number(doc?.totalItems ?? 0),
});
