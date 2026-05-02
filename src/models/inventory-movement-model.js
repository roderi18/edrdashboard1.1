import { ahoraTimestamp, sanitizarFirestoreData } from 'src/utils/firestore-commerce';

export const MOVIMIENTO_INVENTARIO_DEFAULT = {
  productoId: '',
  ordenId: null,
  tipoMovimiento: 'ajuste_manual',
  cantidad: 0,
  disponiblesAntes: 0,
  disponiblesDespues: 0,
  motivo: '',
  fechaCreacion: null,
  creadoPor: null,
};

export const crearDocumentoMovimientoInventario = ({
  productoId,
  ordenId = null,
  tipoMovimiento = 'ajuste_manual',
  cantidad = 0,
  disponiblesAntes = 0,
  disponiblesDespues = 0,
  motivo = '',
  creadoPor = null,
} = {}) =>
  sanitizarFirestoreData({
    ...MOVIMIENTO_INVENTARIO_DEFAULT,
    productoId: String(productoId ?? ''),
    ordenId: ordenId ? String(ordenId) : null,
    tipoMovimiento,
    cantidad: Number(cantidad || 0),
    disponiblesAntes: Number(disponiblesAntes || 0),
    disponiblesDespues: Number(disponiblesDespues || 0),
    motivo,
    fechaCreacion: ahoraTimestamp(),
    creadoPor: creadoPor ? String(creadoPor) : null,
  });
