import {
  ahoraTimestamp,
  timestampToIsoString,
  sanitizarFirestoreData,
  normalizarTextoFirestore,
} from 'src/utils/firestore-commerce';

const mapInventoryType = (available) => {
  const currentAvailable = Number(available) || 0;

  if (currentAvailable <= 0) return 'sin existencias';
  if (currentAvailable <= 10) return 'pocas existencias';

  return 'en existencia';
};

export const PRODUCTO_DEFAULT = {
  productoId: '',
  nombre: '',
  descripcion: '',
  descripcionCorta: '',
  codigo: '',
  sku: '',
  precio: 0,
  precioOferta: 0,
  precioRegistrado: 0,
  precioNoRegistrado: 0,
  precioPendiente: false,
  cantidad: 0,
  disponibles: 0,
  tipoInventario: 'sin existencias',
  renglon: 'general',
  requiereAprobacion: false,
  tipoProducto: 'simple',
  variantes: [],
  notasAdministrativas: '',
  orden: 0,
  publicacion: 'borrador',
  imagenes: [],
  imagenPortada: '',
  categoria: '',
  colores: [],
  tallas: [],
  etiquetas: [],
  genero: [],
  etiquetaNuevo: { habilitada: false, contenido: '' },
  etiquetaOferta: { habilitada: false, contenido: '' },
  totalCalificaciones: 0,
  totalResenas: 0,
  totalVendidos: 0,
  fechaCreacion: null,
  fechaActualizacion: null,
};

export const crearDocumentoProducto = ({
  data = {},
  productoId,
  publicacion = 'publicado',
  fechaCreacion = null,
} = {}) => {
  const cantidad = Number(data?.quantity ?? data?.cantidad ?? 0);
  const disponibles = Number(data?.available ?? data?.disponibles ?? cantidad);
  const images = Array.isArray(data?.images ?? data?.imagenes) ? data.images || data.imagenes : [];
  const precioRegistrado = Number(data?.precioRegistrado ?? data?.registeredPrice ?? 0);
  const precioNoRegistrado = Number(data?.precioNoRegistrado ?? data?.unregisteredPrice ?? 0);
  const renglon = normalizarTextoFirestore(data?.renglon ?? 'general').toLowerCase();
  const tipoProducto = normalizarTextoFirestore(data?.tipoProducto ?? 'simple').toLowerCase();
  const requiereAprobacion = Boolean(
    data?.requiereAprobacion ?? data?.requiresApproval ?? renglon === 'restringido'
  );
  const variantes = Array.isArray(data?.variantes ?? data?.variants)
    ? data.variantes || data.variants
    : [];

  return sanitizarFirestoreData({
    ...PRODUCTO_DEFAULT,
    productoId,
    nombre: normalizarTextoFirestore(data?.name ?? data?.nombre),
    descripcion: data?.description ?? data?.descripcion ?? '',
    descripcionCorta: data?.subDescription ?? data?.descripcionCorta ?? '',
    codigo: normalizarTextoFirestore(data?.code ?? data?.codigo),
    sku: normalizarTextoFirestore(data?.sku),
    precio: Number(data?.price ?? data?.precio ?? 0),
    precioOferta: Number(data?.priceSale ?? data?.precioOferta ?? 0),
    precioRegistrado,
    precioNoRegistrado,
    precioPendiente: Boolean(data?.precioPendiente ?? data?.pendingPrice ?? false),
    cantidad,
    disponibles,
    tipoInventario:
      data?.inventoryTypeEs ?? data?.tipoInventario ?? mapInventoryType(disponibles),
    renglon,
    requiereAprobacion,
    tipoProducto,
    variantes,
    notasAdministrativas:
      data?.notasAdministrativas ?? data?.administrativeNotes ?? '',
    orden: Number(data?.orden ?? data?.sortOrder ?? 0),
    publicacion: publicacion || data?.publicacion || 'borrador',
    imagenes: images,
    imagenPortada: data?.coverUrl ?? data?.imagenPortada ?? images[0] ?? '',
    categoria: data?.category ?? data?.categoria ?? '',
    colores: data?.colors ?? data?.colores ?? [],
    tallas: data?.sizes ?? data?.tallas ?? [],
    etiquetas: data?.tags ?? data?.etiquetas ?? [],
    genero: data?.gender ?? data?.genero ?? [],
    etiquetaNuevo: {
      habilitada: Boolean(data?.newLabel?.enabled ?? data?.etiquetaNuevo?.habilitada ?? false),
      contenido: data?.newLabel?.content ?? data?.etiquetaNuevo?.contenido ?? '',
    },
    etiquetaOferta: {
      habilitada: Boolean(data?.saleLabel?.enabled ?? data?.etiquetaOferta?.habilitada ?? false),
      contenido: data?.saleLabel?.content ?? data?.etiquetaOferta?.contenido ?? '',
    },
    totalCalificaciones: Number(data?.totalRatings ?? data?.totalCalificaciones ?? 0),
    totalResenas: Number(data?.totalReviews ?? data?.totalResenas ?? 0),
    totalVendidos: Number(data?.totalSold ?? data?.totalVendidos ?? 0),
    fechaCreacion: fechaCreacion || ahoraTimestamp(),
    fechaActualizacion: ahoraTimestamp(),
  });
};

export const mapearProductoFirestoreAUi = (doc) => ({
  id: doc?.productoId || doc?.id,
  name: doc?.nombre || '',
  description: doc?.descripcion || '',
  subDescription: doc?.descripcionCorta || '',
  code: doc?.codigo || '',
  sku: doc?.sku || '',
  price: Number(doc?.precio ?? 0),
  priceSale: Number(doc?.precioOferta ?? 0),
  precioRegistrado: Number(doc?.precioRegistrado ?? doc?.precio ?? 0),
  precioNoRegistrado: Number(doc?.precioNoRegistrado ?? doc?.precio ?? 0),
  precioPendiente: Boolean(doc?.precioPendiente ?? false),
  quantity: Number(doc?.cantidad ?? 0),
  available: Number(doc?.disponibles ?? 0),
  inventoryType:
    doc?.tipoInventario === 'sin existencias'
      ? 'out of stock'
      : doc?.tipoInventario === 'pocas existencias'
        ? 'low stock'
        : 'in stock',
  inventoryTypeEs: doc?.tipoInventario || mapInventoryType(doc?.disponibles),
  renglon: doc?.renglon || 'general',
  requiereAprobacion: Boolean(doc?.requiereAprobacion ?? doc?.renglon === 'restringido'),
  tipoProducto: doc?.tipoProducto || 'simple',
  variantes: Array.isArray(doc?.variantes) ? doc.variantes : [],
  notasAdministrativas: doc?.notasAdministrativas || '',
  orden: Number(doc?.orden ?? 0),
  publish: doc?.publicacion === 'publicado' ? 'published' : 'draft',
  images: doc?.imagenes || [],
  coverUrl: doc?.imagenPortada || doc?.imagenes?.[0] || '',
  category: doc?.categoria || '',
  colors: doc?.colores || [],
  sizes: doc?.tallas || [],
  tags: doc?.etiquetas || [],
  gender: doc?.genero || [],
  newLabel: {
    enabled: Boolean(doc?.etiquetaNuevo?.habilitada),
    content: doc?.etiquetaNuevo?.contenido || '',
  },
  saleLabel: {
    enabled: Boolean(doc?.etiquetaOferta?.habilitada),
    content: doc?.etiquetaOferta?.contenido || '',
  },
  totalRatings: Number(doc?.totalCalificaciones ?? 0),
  totalReviews: Number(doc?.totalResenas ?? 0),
  totalSold: Number(doc?.totalVendidos ?? 0),
  createdAt: timestampToIsoString(doc?.fechaCreacion) || doc?.createdAt || null,
  reviews: [],
  ratings: [],
});
