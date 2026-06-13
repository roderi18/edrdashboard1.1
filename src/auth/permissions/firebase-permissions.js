import {
  doc,
  query,
  getDoc,
  setDoc,
  getDocs,
  orderBy,
  writeBatch,
  collection,
  serverTimestamp,
} from 'firebase/firestore';

import { FIRESTORE, isFirebaseConfigured } from 'src/lib/firebase';

import { ROLES_CATALOGO } from './roles';
import { crearDefinicionRol } from './role-permissions';
import { PERMISOS_CATALOGO, COLECCIONES_AUTORIZACION } from './permissions';

const assertFirebase = () => {
  if (!isFirebaseConfigured || !FIRESTORE) {
    throw new Error('Firebase no esta configurado para autorizacion.');
  }
};

const withTimestamps = (payload = {}) => ({
  ...payload,
  activo: payload.activo ?? true,
  actualizadoEnServidor: serverTimestamp(),
});

export async function sincronizarCatalogoAutorizacion({ usuario = null } = {}) {
  assertFirebase();

  const batch = writeBatch(FIRESTORE);

  PERMISOS_CATALOGO.forEach((permiso) => {
    batch.set(
      doc(FIRESTORE, COLECCIONES_AUTORIZACION.permisos, permiso.codigo),
      withTimestamps({
        ...permiso,
        creadoPor: usuario?.uid || usuario?.email || 'sistema',
      }),
      { merge: true }
    );
  });

  ROLES_CATALOGO.map(crearDefinicionRol).forEach((rol) => {
    batch.set(
      doc(FIRESTORE, COLECCIONES_AUTORIZACION.roles, rol.codigo),
      withTimestamps({
        ...rol,
        creadoPor: usuario?.uid || usuario?.email || 'sistema',
      }),
      { merge: true }
    );
  });

  await batch.commit();

  return {
    permisos: PERMISOS_CATALOGO.length,
    roles: ROLES_CATALOGO.length,
  };
}

export async function obtenerRolAutorizacion(rolId) {
  assertFirebase();

  if (!rolId) return null;

  const snapshot = await getDoc(doc(FIRESTORE, COLECCIONES_AUTORIZACION.roles, String(rolId)));

  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}

export async function obtenerCatalogoPermisos() {
  assertFirebase();

  const snapshot = await getDocs(
    query(collection(FIRESTORE, COLECCIONES_AUTORIZACION.permisos), orderBy('modulo', 'asc'))
  );

  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

export async function obtenerRolesAutorizacion() {
  assertFirebase();

  const snapshot = await getDocs(collection(FIRESTORE, COLECCIONES_AUTORIZACION.roles));

  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

export async function obtenerAsignacionRolUsuario(uidUsuario) {
  assertFirebase();

  if (!uidUsuario) return null;

  const snapshot = await getDoc(
    doc(FIRESTORE, COLECCIONES_AUTORIZACION.usuariosRoles, String(uidUsuario))
  );

  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}

export async function obtenerAccesoUsuario(uidUsuario) {
  const asignacion = await obtenerAsignacionRolUsuario(uidUsuario);

  if (!asignacion?.rolId) return asignacion;

  const rol = await obtenerRolAutorizacion(asignacion.rolId);

  return {
    ...asignacion,
    rol,
    permisos: Array.from(new Set([...(rol?.permisos || []), ...(asignacion?.permisos || [])])),
    restricciones: {
      ...(rol?.restricciones || {}),
      ...(asignacion?.restricciones || {}),
    },
  };
}

export async function guardarAsignacionRolUsuario({
  uidUsuario,
  correo = '',
  nombre = '',
  rolId,
  rolNombre = '',
  alcance = {},
  restricciones = {},
  usuario = null,
} = {}) {
  assertFirebase();

  if (!uidUsuario) {
    throw new Error('uidUsuario es requerido para guardar la asignacion de rol.');
  }

  if (!rolId) {
    throw new Error('rolId es requerido para guardar la asignacion de rol.');
  }

  const payload = withTimestamps({
    uidUsuario,
    correo,
    nombre,
    rolId,
    rolNombre,
    alcance,
    restricciones,
    activo: true,
    asignadoPor: usuario?.uid || usuario?.email || 'sistema',
    asignadoEn: new Date().toISOString(),
  });

  await setDoc(doc(FIRESTORE, COLECCIONES_AUTORIZACION.usuariosRoles, String(uidUsuario)), payload, {
    merge: true,
  });

  return payload;
}
