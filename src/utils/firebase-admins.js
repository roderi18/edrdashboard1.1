import {
  doc,
  limit,
  query,
  where,
  getDoc,
  setDoc,
  getDocs,
  deleteDoc,
  updateDoc,
  collection,
  serverTimestamp,
} from 'firebase/firestore';

import { ADMIN_ROLE_IDS } from 'src/utils/admin-role-label';
import { COLECCIONES_NOTIFICACIONES } from 'src/utils/firebase-notificaciones';

import { FIRESTORE } from 'src/lib/firebase';
import { registrarAuditoriaSilenciosa } from 'src/services/audit-log-service';
import { resolverNotificacionConConfiguracion } from 'src/services/notification-service';

// ----------------------------------------------------------------------

const ADMIN_ROLE_VALUES = ['admin', 'administrador'];

const chunkArray = (array = [], size = 30) => {
  const chunks = [];

  for (let index = 0; index < array.length; index += size) {
    chunks.push(array.slice(index, index + size));
  }

  return chunks;
};

// Firestore limita el operador `in` a 30 valores. ADMIN_ROLE_IDS incluye todos
// los roles/cargos organizacionales y puede superar ese limite, por lo que la
// consulta se divide en lotes y se combinan los documentos resultantes.
const getDocsByFieldIn = async (collectionName, field, values = []) => {
  const batches = chunkArray(values, 30);

  const snapshots = await Promise.all(
    batches.map((batch) =>
      getDocs(query(collection(FIRESTORE, collectionName), where(field, 'in', batch))).catch(() => ({
        docs: [],
      }))
    )
  );

  return { docs: snapshots.flatMap((snapshot) => snapshot.docs) };
};

const getProfileKeys = (profile = {}, fallbackId = '') =>
  [
    profile.uid,
    profile.idUsuario,
    profile.uidUsuario,
    profile.idMiembros,
    profile.memberId,
    profile.codigoMiembro,
    profile.codigoUsuario,
    profile.email,
    profile.correo,
    fallbackId,
  ]
    .filter((value) => value !== undefined && value !== null && value !== '')
    .map((value) => String(value).trim().toLowerCase());

const mergeAdminProfile = (profilesByKey, profile = {}, fallbackId = '', source = 'admins') => {
  const keys = getProfileKeys(profile, fallbackId);
  const key = keys.find((candidate) => profilesByKey.has(candidate)) || keys[0] || '';

  if (!key) return;

  const current = profilesByKey.get(key) || {};
  const mergedProfile = {
    ...current,
    ...profile,
    id: current.id || fallbackId || profile.id,
    adminId: current.adminId || (source === 'admins' ? fallbackId : profile.adminId),
    adminSource: current.adminSource || source,
  };

  profilesByKey.forEach((value, candidate) => {
    if (value === current) {
      profilesByKey.set(candidate, mergedProfile);
    }
  });

  keys.forEach((candidate) => {
    profilesByKey.set(candidate, mergedProfile);
  });
};

export const obtenerAdministradores = async () => {
  const [
    adminSnapshot,
    userAdminSnapshot,
    roleAdminSnapshot,
    roleIdAdminSnapshot,
    roleCodeAdminSnapshot,
  ] =
    await Promise.all([
      getDocs(collection(FIRESTORE, 'admins')),
      getDocs(query(collection(FIRESTORE, 'users'), where('rol', 'in', ADMIN_ROLE_VALUES))).catch(
        () => ({ docs: [] })
      ),
      getDocs(
        query(collection(FIRESTORE, 'usuarios_roles'), where('rol', 'in', ADMIN_ROLE_VALUES))
      ).catch(() => ({ docs: [] })),
      getDocsByFieldIn('usuarios_roles', 'rolId', ADMIN_ROLE_IDS),
      getDocsByFieldIn('usuarios_roles', 'roleId', ADMIN_ROLE_IDS),
    ]);
  const profilesByKey = new Map();

  roleCodeAdminSnapshot.docs.forEach((adminDoc) => {
    mergeAdminProfile(profilesByKey, adminDoc.data(), adminDoc.id, 'usuarios_roles');
  });

  roleIdAdminSnapshot.docs.forEach((adminDoc) => {
    mergeAdminProfile(profilesByKey, adminDoc.data(), adminDoc.id, 'usuarios_roles');
  });

  roleAdminSnapshot.docs.forEach((adminDoc) => {
    mergeAdminProfile(profilesByKey, adminDoc.data(), adminDoc.id, 'usuarios_roles');
  });

  userAdminSnapshot.docs.forEach((adminDoc) => {
    mergeAdminProfile(profilesByKey, adminDoc.data(), adminDoc.id, 'users');
  });

  adminSnapshot.docs.forEach((adminDoc) => {
    mergeAdminProfile(profilesByKey, adminDoc.data(), adminDoc.id, 'admins');
  });

  return Array.from(new Set(profilesByKey.values()));
};

const getMemberRoleProfile = async (member) => {
  const memberId = member?.idMiembros || member?.memberId || member?.id;
  const codigoMiembro = member?.memberCode || member?.codigoMiembro || member?.memberId;

  if (memberId) {
    const directSnap = await getDoc(doc(FIRESTORE, 'usuarios_roles', String(memberId)));

    if (directSnap.exists()) {
      return { ref: directSnap.ref, data: directSnap.data() };
    }

    const byMemberId = query(
      collection(FIRESTORE, 'usuarios_roles'),
      where('idMiembros', '==', Number(memberId)),
      limit(1)
    );
    const byMemberIdSnap = await getDocs(byMemberId);

    if (!byMemberIdSnap.empty) {
      const foundSnap = byMemberIdSnap.docs[0];
      return { ref: foundSnap.ref, data: foundSnap.data() };
    }
  }

  if (codigoMiembro) {
    const byCode = query(
      collection(FIRESTORE, 'usuarios_roles'),
      where('codigoMiembro', '==', String(codigoMiembro)),
      limit(1)
    );
    const byCodeSnap = await getDocs(byCode);

    if (!byCodeSnap.empty) {
      const foundSnap = byCodeSnap.docs[0];
      return { ref: foundSnap.ref, data: foundSnap.data() };
    }
  }

  return null;
};

const getQueryDocs = async (collectionName, fieldName, value) => {
  if (value === undefined || value === null || value === '') {
    return [];
  }

  const snapshot = await getDocs(
    query(collection(FIRESTORE, collectionName), where(fieldName, '==', value))
  ).catch(() => ({ docs: [] }));

  return snapshot.docs;
};

const getMatchingProfileDocs = async (collectionName, member = {}) => {
  const memberId = Number(member?.idMiembros || member?.memberId || member?.id) || null;
  const codigoMiembro = member?.memberCode || member?.codigoMiembro || member?.codigoUsuario || '';
  const uid = member?.uid || '';
  const correo = member?.email || member?.correo || '';
  const directDocIds = [uid, memberId, codigoMiembro].filter(Boolean).map(String);
  const docsByPath = new Map();

  await Promise.all(
    directDocIds.map(async (docId) => {
      const snapshot = await getDoc(doc(FIRESTORE, collectionName, docId)).catch(() => null);

      if (snapshot?.exists()) {
        docsByPath.set(snapshot.ref.path, snapshot);
      }
    })
  );

  const queryDocs = (
    await Promise.all([
      getQueryDocs(collectionName, 'uid', uid),
      getQueryDocs(collectionName, 'idMiembros', memberId),
      getQueryDocs(collectionName, 'codigoMiembro', codigoMiembro),
      getQueryDocs(collectionName, 'codigoUsuario', codigoMiembro),
      getQueryDocs(collectionName, 'correo', correo),
      getQueryDocs(collectionName, 'email', correo),
    ])
  ).flat();

  queryDocs.forEach((snapshot) => {
    docsByPath.set(snapshot.ref.path, snapshot);
  });

  return Array.from(docsByPath.values());
};

const getAdminNotificationRecipients = async () => {
  const [adminDocs, userAdminDocs, roleAdminDocs] = await Promise.all([
    getDocs(collection(FIRESTORE, 'admins')).catch(() => ({ docs: [] })),
    getDocs(query(collection(FIRESTORE, 'users'), where('rol', 'in', ['admin', 'administrador']))).catch(
      () => ({ docs: [] })
    ),
    getDocs(
      query(collection(FIRESTORE, 'usuarios_roles'), where('rol', 'in', ['admin', 'administrador']))
    ).catch(() => ({ docs: [] })),
  ]);
  const recipients = new Set();

  [...adminDocs.docs, ...userAdminDocs.docs, ...roleAdminDocs.docs].forEach((snapshot) => {
    const data = snapshot.data() ?? {};
    const uid = String(data.uid || data.idUsuario || snapshot.id || '').trim();

    if (uid) {
      recipients.add(uid);
    }
  });

  return Array.from(recipients);
};

const createAdminRoleNotification = async ({ member = {}, action = 'assigned', adminPayload = {} }) => {
  const idsDestinatarios = await getAdminNotificationRecipients();

  if (!idsDestinatarios.length) {
    return null;
  }

  const memberId = member?.idMiembros || member?.memberId || member?.id || adminPayload.idMiembros || '';
  const codigoMiembro =
    member?.memberCode || member?.codigoMiembro || member?.codigoUsuario || adminPayload.codigoMiembro || '';
  const nombreMiembro =
    member?.name ||
    member?.displayName ||
    adminPayload.displayName ||
    [member?.firstName || member?.nombres || adminPayload.nombres, member?.lastName || member?.apellidos || adminPayload.apellidos]
      .filter(Boolean)
      .join(' ')
      .trim() ||
    codigoMiembro ||
    'Usuario';
  const fechaActual = new Date().toISOString();
  const isAssigned = action === 'assigned';
  const notificationId = `admin_rol_${action}_${memberId || codigoMiembro || Date.now()}_${Date.now()}`;
  const mensaje = isAssigned
    ? 'fue asignado como administrador.'
    : 'fue removido como administrador y ahora es un usuario común.';

  const notificacion = await resolverNotificacionConConfiguracion({
    id: notificationId,
    tipoNotificacion: isAssigned ? 'administrador_creado' : 'permisos_cambiados',
    modulo: 'administradores',
    titulo: isAssigned ? 'Administrador asignado' : 'Administrador removido',
    tituloHtml: `<p><strong>${nombreMiembro}</strong> ${mensaje}</p>`,
    mensaje,
    mensajeVisual: mensaje,
    rolDestinatario: 'admin',
    idsDestinatarios,
    prioridad: 'importante',
    estado: 'no_leida',
    fechaCreacion: fechaActual,
    fechaEnvio: fechaActual,
    actorId: String(memberId || codigoMiembro || 'sistema'),
    actorTipo: 'admin',
    actorNombre: nombreMiembro,
    actorFotoURL: member?.avatarUrl || member?.photoURL || adminPayload.photoURL || null,
    entidadTipo: 'administrador',
    entidadId: memberId || codigoMiembro,
    ruta: '/dashboard/admin',
    metadatos: {
      accion: action,
      idMiembros: memberId || null,
      codigoMiembro,
      nombreMiembro,
    },
    actualizadoEnServidor: serverTimestamp(),
  });

  if (!notificacion) {
    return null;
  }

  await setDoc(
    doc(FIRESTORE, COLECCIONES_NOTIFICACIONES.notificaciones, notificacion.id),
    notificacion
  );

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('notificaciones:actualizar'));
  }

  return notificationId;
};

export const asignarAdministradorDesdeMiembro = async (member, { usuario = {} } = {}) => {
  const memberId = member?.idMiembros || member?.memberId || member?.id;
  const codigoMiembro = member?.memberCode || member?.codigoMiembro || member?.memberId || '';
  const nombres = member?.firstName || member?.nombres || '';
  const apellidos = member?.lastName || member?.apellidos || '';
  const displayName =
    member?.name || [nombres, apellidos].filter(Boolean).join(' ').trim() || codigoMiembro;

  if (!memberId && !codigoMiembro) {
    throw new Error('No se pudo identificar el miembro para asignarlo como administrador.');
  }

  const roleProfile = await getMemberRoleProfile(member);
  const uid = roleProfile?.data?.uid || member?.uid || '';
  const correo = roleProfile?.data?.correo || member?.email || member?.correo || '';
  const adminDocId = uid || String(memberId || codigoMiembro);
  const now = new Date().toISOString();

  const adminPayload = {
    uid,
    idMiembros: Number(memberId) || null,
    codigoMiembro,
    codigoUsuario: codigoMiembro,
    nombres,
    apellidos,
    displayName,
    correo,
    rol: 'administrador',
    estatus: 'activo',
    photoURL: member?.avatarUrl || member?.photoURL || '',
    actualizadoEn: now,
  };

  await setDoc(
    doc(FIRESTORE, 'admins', adminDocId),
    {
      ...adminPayload,
      creadoEn: now,
    },
    { merge: true }
  );

  if (roleProfile?.ref) {
    await updateDoc(roleProfile.ref, {
      rol: 'administrador',
      estado: 'activo',
      actualizadoEn: now,
    });
  } else {
    await setDoc(
      doc(FIRESTORE, 'usuarios_roles', String(memberId || codigoMiembro)),
      {
        idMiembros: Number(memberId) || null,
        codigoMiembro,
        uid,
        correo,
        nombre: displayName,
        rol: 'administrador',
        estado: 'activo',
        creadoEn: now,
        actualizadoEn: now,
      },
      { merge: true }
    );
  }

  if (uid) {
    await setDoc(
      doc(FIRESTORE, 'users', uid),
      {
        uid,
        email: correo,
        username: codigoMiembro,
        codigoMiembro,
        displayName,
        firstName: nombres,
        lastName: apellidos,
        rol: 'administrador',
        role: 'administrador',
        updatedAt: now,
      },
      { merge: true }
    );
  }

  await createAdminRoleNotification({
    member,
    action: 'assigned',
    adminPayload,
  }).catch((error) => {
    console.error('[admins] no se pudo notificar la asignacion de administrador', error);
  });

  registrarAuditoriaSilenciosa({
    modulo: 'administradores',
    accion: 'administrador_asignado',
    descripcion: `${displayName || 'Usuario'} fue asignado como administrador.`,
    severidad: 'importante',
    entidad: {
      tipo: 'administrador',
      id: adminDocId,
      nombre: displayName,
      ruta: '/dashboard/admin',
    },
    despues: adminPayload,
    realizadoPor: usuario,
    metadatos: {
      idMiembros: Number(memberId) || null,
      codigoMiembro,
      uid,
    },
  });

  return {
    id: adminDocId,
    ...adminPayload,
  };
};

export const quitarAdministradorAMiembro = async (member, { usuario = {} } = {}) => {
  const memberId = member?.idMiembros || member?.memberId || member?.id;
  const codigoMiembro = member?.memberCode || member?.codigoMiembro || member?.codigoUsuario || '';
  const adminDocId =
    member?.adminId || member?.adminDocId || member?.uid || String(memberId || codigoMiembro);
  const roleProfile = await getMemberRoleProfile(member);
  const uid = roleProfile?.data?.uid || member?.uid || '';
  const now = new Date().toISOString();

  if (!adminDocId && !memberId && !codigoMiembro && !uid) {
    throw new Error('No se pudo identificar el administrador para quitarle el rol.');
  }

  const adminDocs = await getMatchingProfileDocs('admins', {
    ...member,
    uid,
    codigoMiembro,
    idMiembros: memberId,
  });

  await Promise.all([
    adminDocId ? deleteDoc(doc(FIRESTORE, 'admins', String(adminDocId))).catch(() => null) : null,
    ...adminDocs.map((snapshot) => deleteDoc(snapshot.ref).catch(() => null)),
  ]);

  if (roleProfile?.ref) {
    await updateDoc(roleProfile.ref, {
      rol: 'usuario',
      role: 'usuario',
      estado: 'activo',
      actualizadoEn: now,
    });
  } else if (memberId || codigoMiembro) {
    await setDoc(
      doc(FIRESTORE, 'usuarios_roles', String(memberId || codigoMiembro)),
      {
        idMiembros: Number(memberId) || null,
        codigoMiembro,
        uid,
        correo: member?.email || member?.correo || '',
        nombre: member?.name || member?.displayName || codigoMiembro,
        rol: 'usuario',
        role: 'usuario',
        estado: 'activo',
        actualizadoEn: now,
      },
      { merge: true }
    );
  }

  const roleDocs = await getMatchingProfileDocs('usuarios_roles', {
    ...member,
    uid,
    codigoMiembro,
    idMiembros: memberId,
  });
  const userDocs = await getMatchingProfileDocs('users', {
    ...member,
    uid,
    codigoMiembro,
    idMiembros: memberId,
  });

  await Promise.all(
    roleDocs.map((snapshot) =>
      setDoc(
        snapshot.ref,
        {
          rol: 'usuario',
          role: 'usuario',
          estado: 'activo',
          actualizadoEn: now,
        },
        { merge: true }
      )
    )
  );

  await Promise.all([
    uid
      ? setDoc(
        doc(FIRESTORE, 'users', uid),
        {
          rol: 'usuario',
          role: 'usuario',
          updatedAt: now,
        },
        { merge: true }
      )
      : null,
    ...userDocs.map((snapshot) =>
      setDoc(
        snapshot.ref,
        {
          rol: 'usuario',
          role: 'usuario',
          updatedAt: now,
        },
        { merge: true }
      )
    ),
  ]);

  await createAdminRoleNotification({
    member,
    action: 'removed',
  }).catch((error) => {
    console.error('[admins] no se pudo notificar que se quito el administrador', error);
  });

  registrarAuditoriaSilenciosa({
    modulo: 'administradores',
    accion: 'administrador_removido',
    descripcion: `${member?.name || member?.displayName || codigoMiembro || 'Usuario'} fue removido como administrador.`,
    severidad: 'importante',
    entidad: {
      tipo: 'administrador',
      id: adminDocId || uid || codigoMiembro,
      nombre: member?.name || member?.displayName || codigoMiembro,
      ruta: '/dashboard/admin',
    },
    antes: {
      rol: 'administrador',
      idMiembros: Number(memberId) || null,
      codigoMiembro,
      uid,
    },
    despues: {
      rol: 'usuario',
      idMiembros: Number(memberId) || null,
      codigoMiembro,
      uid,
    },
    realizadoPor: usuario,
  });

  return {
    id: adminDocId,
    idMiembros: Number(memberId) || null,
    codigoMiembro,
    rol: 'usuario',
  };
};
