import {
  doc,
  limit,
  query,
  where,
  getDoc,
  setDoc,
  getDocs,
  deleteDoc,
  collection,
  serverTimestamp,
} from 'firebase/firestore';

import { COLECCIONES_NOTIFICACIONES } from 'src/utils/firebase-notificaciones';
import { notificarCargoDeAdministracion } from 'src/utils/notificar-cargo-administracion';
import { ROLES_DE_ADMINISTRACION, esPerfilDeAdministracion } from 'src/utils/admin-role-label';

import { AUTH, FIRESTORE } from 'src/lib/firebase';
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

// Firestore limita el operador `in` a 30 valores. Hoy la lista son cuatro cargos
// y entra de sobra, pero el troceado se conserva: es la misma funcion que se usaba
// con el catalogo entero y no cuesta nada dejarla a prueba de que crezca.
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
      getDocsByFieldIn('usuarios_roles', 'rolId', ROLES_DE_ADMINISTRACION),
      getDocsByFieldIn('usuarios_roles', 'roleId', ROLES_DE_ADMINISTRACION),
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

  // EL FILTRO VA AQUI Y NO SOLO EN LA CONSULTA.
  //
  // De las cinco fuentes, dos preguntan por el cargo; las otras tres —la
  // coleccion `admins`, `users` y `usuarios_roles` por el campo heredado `rol`—
  // traen a cualquiera que alguna vez pasara por ahi. Sin este colador, un
  // documento viejo de un Coordinador Seccional seguia apareciendo en la lista de
  // administradores aunque su cargo ya no fuera de administracion.
  return Array.from(new Set(profilesByKey.values())).filter(esPerfilDeAdministracion);
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

export const asignarAdministradorDesdeMiembro = async (
  member,
  // `rolDeAdministracion` lo elige quien nombra, en el dialogo. Por defecto sigue
  // siendo Administrador Global para no cambiarle el significado a los llamadores
  // que no lo pasan.
  { usuario = {}, rolDeAdministracion = 'administrador_global' } = {}
) => {
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

  // La coleccion `admins` es el ESPEJO HEREDADO: la lista ya no depende de ella
  // —se consulta `usuarios_roles` por el cargo— y las reglas la tienen cerrada al
  // cliente. Se intenta por compatibilidad con lo que aun la lea y no se toma como
  // un fallo si no entra.
  await setDoc(
    doc(FIRESTORE, 'admins', adminDocId),
    { ...adminPayload, creadoEn: now },
    { merge: true }
  ).catch(() => null);

  // EL CARGO, POR EL SERVIDOR. Igual que al quitarlo: `usuarios_roles` es de solo
  // lectura para el cliente, asi que el `updateDoc` que habia aqui no escribia
  // nada y el recien nombrado no era administrador en ningun sitio.
  await asignarCargoDeAdministracion({
    uidUsuario: String(roleProfile?.ref?.id || uid || memberId || codigoMiembro || ''),
    correo,
    nombre: displayName,
    // EL CARGO LO ELIGE QUIEN NOMBRA. Antes siempre era Administrador Global: el
    // cargo con mas poder de la plataforma se daba con un "si" en un dialogo de
    // confirmacion. El valor por defecto se mantiene por los llamadores antiguos.
    rolId: rolDeAdministracion,
    usuario,
  });

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

/**
 * Cambia el cargo de administracion por la PUERTA DEL SERVIDOR.
 *
 * Una sola funcion para las dos direcciones —nombrar y quitar, que es nombrar
 * `usuario_comun`—, porque las tres reglas viven en la ruta y no se pueden
 * comprobar aqui: que quien reparte es el Administrador Global, que el cargo es uno
 * de los cuatro, y que no se queda ninguno. Dos caminos serian dos sitios por los
 * que escaparse.
 *
 * Si falla, se propaga: cambiar un cargo y que no cambie es peor que el error.
 */
const asignarCargoDeAdministracion = async ({
  uidUsuario,
  correo = '',
  nombre = '',
  rolId,
  usuario = {},
} = {}) => {
  if (!uidUsuario) {
    throw new Error('No se pudo identificar al usuario para cambiarle el cargo.');
  }

  const token = await AUTH?.currentUser?.getIdToken();

  if (!token) {
    throw new Error('Tu sesión expiró: vuelve a entrar para cambiar el cargo.');
  }

  const res = await fetch('/api/admin/asignar-rol-administracion/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ uidUsuario, correo, nombre, rolId, alcance: {} }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data?.error || 'No se pudo cambiar el cargo de administración.');
  }

  // Al interesado. Va DESPUES de que el servidor confirme —nunca se avisa de un
  // cargo que no se guardo— y no bloquea: el cambio ya es real.
  await notificarCargoDeAdministracion({
    uidUsuario,
    nombre,
    rolId,
    rolNombre: data?.asignacion?.rolNombre || '',
    actor: usuario,
  });

  return data;
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

  // EL CARGO SE QUITA POR EL SERVIDOR.
  //
  // `usuarios_roles` es de solo lectura para el cliente, asi que este `updateDoc`
  // no escribia nada: la fila desaparecia de la pantalla y la persona seguia siendo
  // administradora al recargar. La ruta ademas impide dejar la organizacion sin
  // NINGUN Administrador Global, que es lo que pasaba al quitarle el cargo al
  // ultimo: no quedaba nadie que pudiera volver a repartirlos.
  const docRol = String(roleProfile?.ref?.id || uid || memberId || codigoMiembro || '');

  if (docRol) {
    await asignarCargoDeAdministracion({
      uidUsuario: docRol,
      correo: member?.email || member?.correo || '',
      nombre: member?.name || member?.displayName || codigoMiembro,
      rolId: 'usuario_comun',
      usuario,
    });
  }

  // Ya no se buscan los documentos de `usuarios_roles`: no se pueden escribir
  // desde aqui y el cargo lo puso el servidor. Buscarlos era una consulta de mas
  // para un espejo que no llegaba a escribirse.
  const userDocs = await getMatchingProfileDocs('users', {
    ...member,
    uid,
    codigoMiembro,
    idMiembros: memberId,
  });

  // AQUI HABIA UN ESPEJO A MANO SOBRE `usuarios_roles`, Y ERA EL QUE REVENTABA.
  //
  // Recorria los documentos de rol de la persona y les escribia `rol: 'usuario'`.
  // Esa coleccion es `allow write: if false` para el cliente —a proposito: antes
  // cualquiera reescribia el suyo y se concedia el rol—, asi que la escritura
  // moria en las reglas y, al no estar recogida, salia a la pantalla como
  // "Missing or insufficient permissions" DESPUES de que el cambio ya se hubiera
  // hecho bien. El administrador global veia un error por un cambio que si habia
  // ocurrido.
  //
  // Ya no hace falta: el cargo lo escribe el servidor unas lineas mas arriba, por
  // `asignarCargoDeAdministracion`, que es la unica via que las reglas aceptan.
  //
  // El espejo de `users` si se conserva —esa coleccion si es escribible— pero
  // best-effort: es una copia de cortesia para pantallas que aun la leen, y que
  // falle no puede tumbar un cambio que ya esta hecho.
  await Promise.all(
    [
      uid ? doc(FIRESTORE, 'users', uid) : null,
      ...userDocs.map((snapshot) => snapshot.ref),
    ]
      .filter(Boolean)
      .map((referencia) =>
        setDoc(
          referencia,
          { rol: 'usuario', role: 'usuario', updatedAt: now },
          { merge: true }
        ).catch(() => null)
      )
  );

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
