import {
  doc,
  limit,
  query,
  setDoc,
  getDocs,
  orderBy,
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
  uid: usuario.uid || usuario.id || '',
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

const getLogRef = (idMiembro, idHistorial) =>
  doc(
    FIRESTORE,
    COLECCION_HISTORIAL_MIEMBROS,
    String(idMiembro),
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

  return date
    ? new Intl.DateTimeFormat('es-DO', {
        hour: '2-digit',
        minute: '2-digit',
      }).format(date)
    : '';
};

export const crearRegistroHistorialMiembro = async ({
  idMiembro,
  codigoMiembro = '',
  nombreMiembro = '',
  modulo,
  campo,
  campoAfectado,
  antes,
  despues,
  usuario,
  metadata = {},
}) => {
  if (!isFirebaseConfigured || !FIRESTORE || !idMiembro || !modulo || !campoAfectado) {
    return null;
  }

  const idHistorial = getRegistroId();
  const fecha = new Date().toISOString();
  const registro = {
    idHistorial,
    idMiembro: String(idMiembro),
    codigoMiembro: String(codigoMiembro || ''),
    nombreMiembro: nombreMiembro || '',
    modulo,
    campo: campo || campoAfectado,
    campoAfectado,
    valorAnterior: normalizeValue(antes),
    valorNuevo: normalizeValue(despues),
    realizadoPor: getUsuarioHistorial(usuario),
    fecha,
    fechaServidor: serverTimestamp(),
    metadata,
  };

  await setDoc(getLogRef(idMiembro, idHistorial), registro);

  return registro;
};

export const registrarCambiosHistorialMiembro = async ({
  idMiembro,
  codigoMiembro = '',
  nombreMiembro = '',
  modulo,
  antes = {},
  despues = {},
  campos = {},
  usuario,
  metadata = {},
}) => {
  if (!idMiembro || !modulo) return [];

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
        idMiembro,
        codigoMiembro,
        nombreMiembro,
        modulo,
        usuario,
        metadata,
        ...cambio,
      })
    )
  );
};

export const listarHistorialMiembro = async (idMiembro, maxRegistros = 100) => {
  if (!isFirebaseConfigured || !FIRESTORE || !idMiembro) return [];

  const registrosRef = collection(
    FIRESTORE,
    COLECCION_HISTORIAL_MIEMBROS,
    String(idMiembro),
    SUBCOLECCION_REGISTROS_HISTORIAL
  );

  const snapshot = await getDocs(
    query(registrosRef, orderBy('fechaServidor', 'desc'), limit(maxRegistros))
  ).catch(() => getDocs(query(registrosRef, limit(maxRegistros))));

  return snapshot.docs.map((item) => {
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
  });
};
