import {
  doc,
  setDoc,
  getDocs,
  collection,
  serverTimestamp,
} from 'firebase/firestore';

import { COLECCIONES_NOTIFICACIONES } from 'src/utils/firebase-notificaciones';

import { FIRESTORE, isFirebaseConfigured } from 'src/lib/firebase';

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
}) {
  if (!isFirebaseConfigured || !FIRESTORE || !tipoNotificacion) {
    throw new Error('No se pudo guardar la configuracion de notificaciones.');
  }

  await Promise.all([
    setDoc(
      doc(FIRESTORE, COLECCIONES_NOTIFICACIONES.tipos, tipoNotificacion),
      {
        ...tipo,
        tipoNotificacion,
        fechaActualizacion: serverTimestamp(),
      },
      { merge: true }
    ),
    setDoc(
      doc(FIRESTORE, COLECCIONES_NOTIFICACIONES.plantillas, tipoNotificacion),
      {
        ...plantilla,
        tipoNotificacion,
        modulo: tipo.modulo || plantilla.modulo || '',
        fechaActualizacion: serverTimestamp(),
      },
      { merge: true }
    ),
  ]);
}

export async function guardarPreferenciaDestinatarioNotificacion({
  idUsuario,
  rol = 'usuario',
  tipoNotificacion,
  activo,
}) {
  if (!isFirebaseConfigured || !FIRESTORE || !idUsuario || !tipoNotificacion) {
    throw new Error('No se pudo guardar la preferencia del destinatario.');
  }

  await setDoc(
    doc(FIRESTORE, COLECCIONES_NOTIFICACIONES.preferencias, String(idUsuario)),
    {
      idUsuario: String(idUsuario),
      rol: isAdminRole(rol) ? 'admin' : 'usuario',
      tiposNotificacion: {
        [tipoNotificacion]: Boolean(activo),
      },
      fechaActualizacion: serverTimestamp(),
    },
    { merge: true }
  );
}
