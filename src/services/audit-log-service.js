import {
  doc,
  limit,
  query,
  where,
  setDoc,
  getDocs,
  orderBy,
  deleteDoc,
  collection,
  serverTimestamp,
} from 'firebase/firestore';

import { FIRESTORE, isFirebaseConfigured } from 'src/lib/firebase';

// ----------------------------------------------------------------------

export const COLECCION_AUDITORIA_SISTEMA = 'auditoria_sistema';

const normalizarValor = (value) => {
  if (value === undefined) return null;

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map(normalizarValor);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entryValue]) => [key, normalizarValor(entryValue)])
    );
  }

  return value;
};

const obtenerNombreUsuario = (usuario = {}) =>
  usuario.displayName ||
  usuario.nombre ||
  [usuario.firstName || usuario.nombres, usuario.lastName || usuario.apellidos]
    .filter(Boolean)
    .join(' ')
    .trim() ||
  usuario.email ||
  usuario.correo ||
  'Sistema';

const normalizarUsuario = (usuario = {}) => ({
  idUsuario: String(usuario.uid || usuario.idUsuario || usuario.id || '').trim() || null,
  idMiembros: usuario.idMiembros || usuario.memberId || null,
  codigoMiembro: usuario.codigoMiembro || usuario.username || usuario.codigoUsuario || null,
  nombre: obtenerNombreUsuario(usuario),
  correo: usuario.email || usuario.correo || null,
  rol: usuario.rol || usuario.role || null,
});

const normalizarFecha = (value) => {
  if (!value) return null;

  if (typeof value.toDate === 'function') {
    return value.toDate().toISOString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return value;
};

export const mapearAuditoriaFirestoreAUi = (snapshot) => {
  const data = snapshot.data();

  return {
    id: snapshot.id,
    ...data,
    fecha: normalizarFecha(data.fecha),
    fechaServidor: normalizarFecha(data.fechaServidor),
  };
};

export async function registrarAuditoriaSistema({
  modulo = '',
  accion = '',
  descripcion = '',
  resultado = 'exitoso',
  severidad = 'informativa',
  entidad = {},
  antes = null,
  despues = null,
  realizadoPor = {},
  origen = 'aplicacion',
  metadatos = {},
} = {}) {
  if (!isFirebaseConfigured || !FIRESTORE || !modulo || !accion) {
    return null;
  }

  const auditRef = doc(collection(FIRESTORE, COLECCION_AUDITORIA_SISTEMA));
  const fecha = new Date().toISOString();
  const registro = {
    idAuditoria: auditRef.id,
    modulo,
    accion,
    descripcion,
    resultado,
    severidad,
    entidad: normalizarValor({
      tipo: entidad.tipo || null,
      id: entidad.id ? String(entidad.id) : null,
      nombre: entidad.nombre || null,
      ruta: entidad.ruta || null,
    }),
    antes: normalizarValor(antes),
    despues: normalizarValor(despues),
    realizadoPor: normalizarValor(normalizarUsuario(realizadoPor)),
    origen,
    metadatos: normalizarValor(metadatos),
    fecha,
    fechaServidor: serverTimestamp(),
  };

  await setDoc(auditRef, registro);

  return {
    id: auditRef.id,
    ...registro,
  };
}

export async function registrarAuditoriaSilenciosa(payload = {}) {
  try {
    return await registrarAuditoriaSistema(payload);
  } catch (error) {
    console.error('[auditoria] no se pudo registrar el evento', error);
    return null;
  }
}

export async function listarAuditoriaSistema({ maxRegistros = 150 } = {}) {
  if (!isFirebaseConfigured || !FIRESTORE) {
    return [];
  }

  const auditCollection = collection(FIRESTORE, COLECCION_AUDITORIA_SISTEMA);

  try {
    const snapshot = await getDocs(
      query(auditCollection, orderBy('fecha', 'desc'), limit(maxRegistros))
    );

    return snapshot.docs.map(mapearAuditoriaFirestoreAUi);
  } catch (error) {
    console.error('[auditoria] no se pudo ordenar por fecha, se cargara sin indice', error);

    const snapshot = await getDocs(query(auditCollection, limit(maxRegistros)));

    return snapshot.docs
      .map(mapearAuditoriaFirestoreAUi)
      .sort((a, b) => new Date(b.fecha || 0).getTime() - new Date(a.fecha || 0).getTime());
  }
}

export async function eliminarAuditoriaTemporalPrueba() {
  if (!isFirebaseConfigured || !FIRESTORE) {
    return 0;
  }

  const snapshot = await getDocs(
    query(
      collection(FIRESTORE, COLECCION_AUDITORIA_SISTEMA),
      where('origen', '==', 'prueba_localhost'),
      limit(500)
    )
  );

  await Promise.all(snapshot.docs.map((item) => deleteDoc(item.ref)));

  return snapshot.docs.length;
}
