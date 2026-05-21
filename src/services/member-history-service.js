import {
  doc,
  limit,
  query,
  getDoc,
  getDocs,
  orderBy,
  increment,
  writeBatch,
  startAfter,
  collection,
  serverTimestamp,
} from 'firebase/firestore';

import { FIRESTORE, isFirebaseConfigured } from 'src/lib/firebase';

export const COLECCION_HISTORIAL_MIEMBROS = 'historialMiembros';
export const SUBCOLECCION_REGISTROS_HISTORIAL = 'registros';

const getRegistroId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}_${Math.random().toString(36).slice(2)}`;

const getNombreUsuario = (usuario = {}) =>
  usuario.displayName ||
  usuario.name ||
  [usuario.nombres, usuario.apellidos].filter(Boolean).join(' ') ||
  usuario.email ||
  usuario.codigoMiembro ||
  'Sistema';

const getUsuarioHistorial = (usuario = {}) => ({
  idUsuario: usuario.uid || usuario.id || '',
  idMiembros: usuario.idMiembros || usuario.memberId || '',
  codigoMiembro: usuario.codigoMiembro || usuario.codigoUsuario || '',
  nombre: getNombreUsuario(usuario),
  correo: usuario.email || usuario.correo || '',
  rol: usuario.role || usuario.rol || '',
});

const normalizeValue = (value) => {
  if (value === undefined || value === null) return '';
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  if (typeof value === 'string') return value.trim();

  if (value?.toDate) {
    return value.toDate().toISOString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map(normalizeValue).filter(Boolean).join(', ');
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value);
};

const valuesAreEqual = (before, after) => normalizeValue(before) === normalizeValue(after);

const normalizeIdMiembros = (value) => {
  const numericValue = Number(value);

  return Number.isFinite(numericValue) && String(value).trim() !== '' ? numericValue : value;
};

const getMemberHistoryRef = (idMiembros) =>
  doc(FIRESTORE, COLECCION_HISTORIAL_MIEMBROS, String(idMiembros));

const getLogRef = (idMiembros, idHistorial) =>
  doc(
    FIRESTORE,
    COLECCION_HISTORIAL_MIEMBROS,
    String(idMiembros),
    SUBCOLECCION_REGISTROS_HISTORIAL,
    idHistorial
  );

const toDate = (value) => {
  if (!value) return null;
  if (value?.toDate) return value.toDate();
  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
};

const formatDate = (value) => {
  const date = toDate(value);

  return date
    ? new Intl.DateTimeFormat('es-DO', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(date)
    : '';
};

const formatTime = (value) => {
  const date = toDate(value);

  if (!date) return '';

  const time = new Intl.DateTimeFormat('es-DO', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(date);

  return time.replace(/\s*a\.\s*m\./i, ' A.M.').replace(/\s*p\.\s*m\./i, ' P.M.');
};

const mapHistoryDoc = (item) => {
  const data = item.data();

  return {
    id: data.idHistorial || item.id,
    fecha: formatDate(data.fechaServidor || data.fecha),
    hora: formatTime(data.fechaServidor || data.fecha),
    modulo: data.modulo || '',
    afectado: data.campoAfectado || data.campo || '',
    antes: data.valorAnterior || '',
    despues: data.valorNuevo || '',
    realizadoPor: data.realizadoPor?.nombre || 'Sistema',
    raw: data,
  };
};

export const crearRegistroHistorialMiembro = async ({
  idMiembro,
  idMiembros,
  codigoMiembro = '',
  nombreMiembro = '',
  modulo,
  campo,
  campoAfectado,
  antes,
  despues,
  usuario,
  metadata = {},
  metadatos,
}) => {
  const resolvedIdMiembros = idMiembros || idMiembro;

  if (!isFirebaseConfigured || !FIRESTORE || !resolvedIdMiembros || !modulo || !campoAfectado) {
    return null;
  }

  const idHistorial = getRegistroId();
  const fecha = new Date().toISOString();
  const realizadoPor = getUsuarioHistorial(usuario);
  const normalizedIdMiembros = normalizeIdMiembros(resolvedIdMiembros);
  const normalizedCodigoMiembro = String(codigoMiembro || '');
  const normalizedNombreMiembro = nombreMiembro || '';
  const normalizedMetadatos = metadatos || metadata || {};

  const registro = {
    idHistorial,
    idMiembros: normalizedIdMiembros,
    codigoMiembro: normalizedCodigoMiembro,
    nombreMiembro: normalizedNombreMiembro,
    modulo,
    campo: campo || campoAfectado,
    campoAfectado,
    valorAnterior: normalizeValue(antes),
    valorNuevo: normalizeValue(despues),
    realizadoPor,
    fecha,
    fechaServidor: serverTimestamp(),
    metadatos: normalizedMetadatos,
  };

  const miembroResumen = {
    idMiembros: normalizedIdMiembros,
    codigoMiembro: normalizedCodigoMiembro,
    nombreMiembro: normalizedNombreMiembro,
    totalRegistros: increment(1),
    fechaUltimoCambio: serverTimestamp(),
    actualizadoPor: realizadoPor.nombre,
    realizadoPor,
  };

  const batch = writeBatch(FIRESTORE);

  batch.set(getMemberHistoryRef(resolvedIdMiembros), miembroResumen, { merge: true });
  batch.set(getLogRef(resolvedIdMiembros, idHistorial), registro);

  await batch.commit();

  return registro;
};

export const registrarCambiosHistorialMiembro = async ({
  idMiembro,
  idMiembros,
  codigoMiembro = '',
  nombreMiembro = '',
  modulo,
  antes = {},
  despues = {},
  campos = {},
  usuario,
  metadata = {},
  metadatos,
}) => {
  const resolvedIdMiembros = idMiembros || idMiembro;

  if (!resolvedIdMiembros || !modulo) return [];

  const keys = Object.keys(campos).length
    ? Object.keys(campos)
    : Array.from(new Set([...Object.keys(antes || {}), ...Object.keys(despues || {})]));

  const cambios = keys
    .filter((key) => !valuesAreEqual(antes?.[key], despues?.[key]))
    .map((key) => ({
      campo: key,
      campoAfectado: campos[key] || key,
      antes: antes?.[key],
      despues: despues?.[key],
    }));

  if (!cambios.length) return [];

  return Promise.all(
    cambios.map((cambio) =>
      crearRegistroHistorialMiembro({
        idMiembros: resolvedIdMiembros,
        codigoMiembro,
        nombreMiembro,
        modulo,
        usuario,
        metadatos: metadatos || metadata,
        ...cambio,
      })
    )
  );
};

export const listarHistorialMiembro = async (idMiembros, maxRegistros = 100) => {
  if (!isFirebaseConfigured || !FIRESTORE || !idMiembros) return [];

  const result = await listarHistorialMiembroPagina(idMiembros, { maxRegistros });

  return result.registros;
};

export const listarHistorialMiembroPagina = async (
  idMiembros,
  { maxRegistros = 5, cursor = null } = {}
) => {
  if (!isFirebaseConfigured || !FIRESTORE || !idMiembros) {
    return {
      registros: [],
      totalRegistros: 0,
      ultimoDocumento: null,
      hayMas: false,
    };
  }

  const historyRef = getMemberHistoryRef(idMiembros);
  const historyDoc = await getDoc(historyRef).catch(() => null);
  const totalRegistros = Number(historyDoc?.data()?.totalRegistros || 0);

  const registrosRef = collection(
    FIRESTORE,
    COLECCION_HISTORIAL_MIEMBROS,
    String(idMiembros),
    SUBCOLECCION_REGISTROS_HISTORIAL
  );

  const orderedQuery = cursor
    ? query(registrosRef, orderBy('fechaServidor', 'desc'), startAfter(cursor), limit(maxRegistros))
    : query(registrosRef, orderBy('fechaServidor', 'desc'), limit(maxRegistros));

  const fallbackQuery = cursor
    ? query(registrosRef, startAfter(cursor), limit(maxRegistros))
    : query(registrosRef, limit(maxRegistros));

  const snapshot = await getDocs(orderedQuery).catch(() => getDocs(fallbackQuery));
  const registros = snapshot.docs.map(mapHistoryDoc);
  const safeTotal = totalRegistros || registros.length;

  return {
    registros,
    totalRegistros: safeTotal,
    ultimoDocumento: snapshot.docs[snapshot.docs.length - 1] || null,
    hayMas: registros.length === maxRegistros && safeTotal > registros.length,
  };
};
