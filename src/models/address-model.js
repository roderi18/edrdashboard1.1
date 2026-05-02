import {
  ahoraTimestamp,
  TEXTO_SIN_DIRECCION,
  TEXTO_SIN_TELEFONO,
  sanitizarFirestoreData,
  normalizarTextoFirestore,
  construirDireccionCompleta,
} from 'src/utils/firestore-commerce';

export const DIRECCION_DEFAULT = {
  usuarioId: '',
  miembroId: null,
  etiqueta: '',
  tipo: 'adicional',
  nombre: '',
  provincia: '',
  municipio: '',
  sector: '',
  calle: '',
  direccionCompleta: '',
  telefono: '',
  esPredeterminada: false,
  esPrimaria: false,
  esDestacamento: false,
  bloqueada: false,
  bloqueadaEdicion: false,
  esSistema: false,
  fechaCreacion: null,
  fechaActualizacion: null,
};

export const crearDocumentoDireccion = ({
  id,
  usuarioId,
  miembroId = null,
  etiqueta = '',
  tipo = 'adicional',
  nombre = '',
  provincia = '',
  municipio = '',
  sector = '',
  calle = '',
  telefono = '',
  esPredeterminada = false,
  esPrimaria = false,
  esDestacamento = false,
  bloqueada = false,
  bloqueadaEdicion = false,
  esSistema = false,
  fechaCreacion = null,
} = {}) => {
  const direccionCompleta =
    construirDireccionCompleta({ provincia, municipio, sector, calle }) || TEXTO_SIN_DIRECCION;

  return sanitizarFirestoreData({
    ...DIRECCION_DEFAULT,
    id: id || null,
    usuarioId,
    miembroId,
    etiqueta: etiqueta || tipo,
    tipo,
    nombre: normalizarTextoFirestore(nombre),
    provincia: normalizarTextoFirestore(provincia),
    municipio: normalizarTextoFirestore(municipio),
    sector: normalizarTextoFirestore(sector),
    calle: normalizarTextoFirestore(calle),
    direccionCompleta,
    telefono: normalizarTextoFirestore(telefono) || TEXTO_SIN_TELEFONO,
    esPredeterminada,
    esPrimaria,
    esDestacamento,
    bloqueada,
    bloqueadaEdicion,
    esSistema,
    fechaCreacion: fechaCreacion || ahoraTimestamp(),
    fechaActualizacion: ahoraTimestamp(),
  });
};

export const mapearDireccionFirestoreAUi = (doc) => ({
  id: doc?.id,
  firestoreId: doc?.id,
  name: doc?.nombre || '',
  addressType:
    doc?.tipo === 'destacamento'
      ? 'Destacamento'
      : doc?.tipo === 'primaria'
        ? 'Primaria'
        : doc?.tipo === 'casa'
          ? 'Casa'
          : doc?.tipo === 'oficina'
            ? 'Oficina'
            : doc?.etiqueta || 'Direccion',
  fullAddress: doc?.direccionCompleta || TEXTO_SIN_DIRECCION,
  addressFields: {
    province: doc?.provincia || '',
    municipality: doc?.municipio || '',
    sector: doc?.sector || '',
    detail: doc?.calle || '',
  },
  phoneNumber: doc?.telefono || TEXTO_SIN_TELEFONO,
  primary: Boolean(doc?.esPredeterminada),
  locked: Boolean(doc?.bloqueada),
  editLocked: Boolean(doc?.bloqueadaEdicion),
  isPrimaryAddress: Boolean(doc?.esPrimaria),
  isDestAddress: Boolean(doc?.esDestacamento),
});
