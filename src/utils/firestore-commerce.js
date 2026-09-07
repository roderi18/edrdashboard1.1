import { Timestamp } from 'firebase/firestore';

export const COLECCIONES_COMERCIO = {
  carritos: 'carritos',
  // Un documento por año con el ultimo numero de recibo entregado. Ver
  // `order-number-service`.
  contadores: 'contadores_comercio',
  ordenes: 'ordenes',
  recibos: 'recibos',
  direcciones: 'direcciones',
  productos: 'productos',
  resenasProductos: 'resenas_productos',
  movimientosInventario: 'movimientos_inventario',
};

export const TEXTO_SIN_TELEFONO = 'Sin numero de telefono';
export const TEXTO_SIN_DIRECCION = 'Direccion no especificada';

export const ahoraTimestamp = () => Timestamp.now();

export const normalizarTextoFirestore = (value) => String(value ?? '').trim();

export const normalizarClaveFirestore = (value) =>
  normalizarTextoFirestore(value).toLowerCase().replace(/\s+/g, '');

export const tieneValorFirestore = (value) =>
  value !== null && value !== undefined && value !== '';

export const obtenerIdUsuarioComercio = (user = {}) => {
  const candidates = [user?.uid, user?.id, user?.correo, user?.email, user?.memberId];
  const firstValue = candidates.find(tieneValorFirestore);

  return firstValue ? String(firstValue) : null;
};

export const obtenerIdMiembroComercio = (user = {}) => {
  const candidates = [user?.idMiembros, user?.memberId, user?.codigoMiembro, user?.codigo];
  const firstValue = candidates.find(tieneValorFirestore);

  return firstValue ? String(firstValue) : null;
};

export const construirDireccionCompleta = ({
  provincia = '',
  municipio = '',
  sector = '',
  calle = '',
} = {}) =>
  [provincia, municipio, sector, calle]
    .map((item) => normalizarTextoFirestore(item))
    .filter(Boolean)
    .join(', ');

export const dividirDireccionCompleta = (direccion = '') => {
  const [provincia = '', municipio = '', sector = '', calle = ''] = normalizarTextoFirestore(
    direccion
  )
    .split(',')
    .map((item) => item.trim());

  return {
    provincia,
    municipio,
    sector,
    calle,
  };
};

export const timestampToIsoString = (value) => {
  if (!value) return null;
  if (typeof value?.toDate === 'function') return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

export const sanitizarFirestoreData = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizarFirestoreData(item));
  }

  if (value && typeof value === 'object' && typeof value?.toDate !== 'function') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, sanitizarFirestoreData(item)])
    );
  }

  return value === undefined ? null : value;
};
