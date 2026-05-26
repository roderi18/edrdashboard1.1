import {
  doc,
  setDoc,
  getDoc,
  getDocs,
  collection,
  serverTimestamp,
} from 'firebase/firestore';

import { COLECCIONES_NOTIFICACIONES } from 'src/utils/firebase-notificaciones';

import { FIRESTORE, isFirebaseConfigured } from 'src/lib/firebase';
import { registrarAuditoriaSilenciosa } from 'src/services/audit-log-service';

// ----------------------------------------------------------------------

const isAdminRole = (value = '') => {
  const role = String(value || '').toLowerCase();
  return role === 'admin' || role === 'administrador' || role === 'administrator';
};

const getRecipientId = (data = {}, docId = '') =>
  String(data.uid || data.idUsuario || data.idMiembros || docId || '').trim();

const getRecipientName = (data = {}, docId = '') =>
  data.displayName ||
  data.nombre ||
  [data.nombres, data.apellidos].filter(Boolean).join(' ').trim() ||
  data.email ||
  data.correo ||
  docId;

const addRecipient = (map, data = {}, docId = '', collectionName = '') => {
  const idUsuario = getRecipientId(data, docId);

  if (!idUsuario) return;

  const current = map.get(idUsuario) || {};
  const role = collectionName === 'admins' || isAdminRole(data.rol || data.role)
    ? 'admin'
    : 'usuario';
  const nextRole = current.rol === 'admin' ? 'admin' : role;

  map.set(idUsuario, {
    ...current,
    idUsuario,
    rol: nextRole,
    nombre: current.nombre || getRecipientName(data, docId),
    correo: current.correo || data.correo || data.email || '',
    origenes: [...new Set([...(current.origenes || []), collectionName])],
  });
};

export async function listarConfiguracionNotificaciones() {
  if (!isFirebaseConfigured || !FIRESTORE) {
    return {
      tipos: [],
      plantillas: [],
      preferencias: [],
      destinatarios: [],
    };
  }

  const [tiposSnap, plantillasSnap, preferenciasSnap, adminsSnap, usersSnap, rolesSnap] =
    await Promise.all([
      getDocs(collection(FIRESTORE, COLECCIONES_NOTIFICACIONES.tipos)),
      getDocs(collection(FIRESTORE, COLECCIONES_NOTIFICACIONES.plantillas)),
      getDocs(collection(FIRESTORE, COLECCIONES_NOTIFICACIONES.preferencias)),
      getDocs(collection(FIRESTORE, 'admins')).catch(() => ({ docs: [] })),
      getDocs(collection(FIRESTORE, 'users')).catch(() => ({ docs: [] })),
      getDocs(collection(FIRESTORE, 'usuarios_roles')).catch(() => ({ docs: [] })),
    ]);

  const destinatariosMap = new Map();

  adminsSnap.docs.forEach((item) => addRecipient(destinatariosMap, item.data(), item.id, 'admins'));
  usersSnap.docs.forEach((item) => addRecipient(destinatariosMap, item.data(), item.id, 'users'));
  rolesSnap.docs.forEach((item) =>
    addRecipient(destinatariosMap, item.data(), item.id, 'usuarios_roles')
  );

  return {
    tipos: tiposSnap.docs.map((item) => ({ id: item.id, ...item.data() })),
    plantillas: plantillasSnap.docs.map((item) => ({ id: item.id, ...item.data() })),
    preferencias: preferenciasSnap.docs.map((item) => ({ id: item.id, ...item.data() })),
    destinatarios: Array.from(destinatariosMap.values()).sort((a, b) =>
      String(a.nombre).localeCompare(String(b.nombre))
    ),
  };
}

export async function guardarConfiguracionTipoNotificacion({
  tipoNotificacion,
  tipo = {},
  plantilla = {},
  usuario = {},
}) {
  if (!isFirebaseConfigured || !FIRESTORE || !tipoNotificacion) {
    throw new Error('No se pudo guardar la configuracion de notificaciones.');
  }

  const tipoRef = doc(FIRESTORE, COLECCIONES_NOTIFICACIONES.tipos, tipoNotificacion);
  const plantillaRef = doc(FIRESTORE, COLECCIONES_NOTIFICACIONES.plantillas, tipoNotificacion);
  const [tipoAnteriorSnap, plantillaAnteriorSnap] = await Promise.all([
    getDoc(tipoRef).catch(() => null),
    getDoc(plantillaRef).catch(() => null),
  ]);
  const tipoAnterior = tipoAnteriorSnap?.exists() ? tipoAnteriorSnap.data() : null;
  const plantillaAnterior = plantillaAnteriorSnap?.exists() ? plantillaAnteriorSnap.data() : null;
  const tipoSiguiente = {
    ...tipo,
    tipoNotificacion,
    fechaActualizacion: serverTimestamp(),
  };
  const plantillaSiguiente = {
    ...plantilla,
    tipoNotificacion,
    modulo: tipo.modulo || plantilla.modulo || '',
    fechaActualizacion: serverTimestamp(),
  };

  await Promise.all([
    setDoc(tipoRef, tipoSiguiente, { merge: true }),
    setDoc(plantillaRef, plantillaSiguiente, { merge: true }),
  ]);

  registrarAuditoriaSilenciosa({
    modulo: 'notificaciones',
    accion: 'configuracion_tipo_actualizada',
    descripcion: `Configuración de notificación actualizada: ${tipo.titulo || tipoNotificacion}.`,
    severidad: 'importante',
    entidad: {
      tipo: 'tipo_notificacion',
      id: tipoNotificacion,
      nombre: tipo.titulo || plantilla.tituloPlantilla || tipoNotificacion,
      ruta: '/dashboard/admin/notifications',
    },
    antes: {
      tipo: tipoAnterior,
      plantilla: plantillaAnterior,
    },
    despues: {
      tipo: { ...tipo, tipoNotificacion, fechaActualizacion: 'fecha_servidor' },
      plantilla: {
        ...plantilla,
        tipoNotificacion,
        modulo: tipo.modulo || plantilla.modulo || '',
        fechaActualizacion: 'fecha_servidor',
      },
    },
    realizadoPor: usuario,
  });
}

export async function guardarPreferenciaDestinatarioNotificacion({
  idUsuario,
  rol = 'usuario',
  tipoNotificacion,
  activo,
  usuario = {},
}) {
  if (!isFirebaseConfigured || !FIRESTORE || !idUsuario || !tipoNotificacion) {
    throw new Error('No se pudo guardar la preferencia del destinatario.');
  }

  const preferenciaRef = doc(
    FIRESTORE,
    COLECCIONES_NOTIFICACIONES.preferencias,
    String(idUsuario)
  );
  const preferenciaSiguiente = {
    idUsuario: String(idUsuario),
    rol: isAdminRole(rol) ? 'admin' : 'usuario',
    tiposNotificacion: {
      [tipoNotificacion]: Boolean(activo),
    },
    fechaActualizacion: serverTimestamp(),
  };

  await setDoc(preferenciaRef, preferenciaSiguiente, { merge: true });

  registrarAuditoriaSilenciosa({
    modulo: 'notificaciones',
    accion: 'preferencia_destinatario_actualizada',
    descripcion: `Preferencia de destinatario actualizada para ${tipoNotificacion}.`,
    entidad: {
      tipo: 'preferencia_notificacion',
      id: `${idUsuario}:${tipoNotificacion}`,
      nombre: String(idUsuario),
      ruta: '/dashboard/admin/notifications',
    },
    despues: {
      ...preferenciaSiguiente,
      fechaActualizacion: 'fecha_servidor',
    },
    realizadoPor: usuario,
    metadatos: {
      idUsuario: String(idUsuario),
      tipoNotificacion,
      activo: Boolean(activo),
    },
  });
}
