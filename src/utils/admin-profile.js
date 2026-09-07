import { doc, limit, query, where, getDoc, getDocs, collection } from 'firebase/firestore';

import { FIRESTORE, isFirebaseConfigured } from 'src/lib/firebase';

// ----------------------------------------------------------------------

export const ADMIN_COLLECTION = 'admins';

export const fileToDataUrl = (file) =>
  new Promise((resolve, reject) => {
    if (!(file instanceof File)) {
      resolve(file ?? '');
      return;
    }

    const reader = new FileReader();

    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

export const getProfileRefByUid = async (collectionName, uid) => {
  if (!isFirebaseConfigured || !FIRESTORE) {
    return null;
  }

  if (!uid) {
    return null;
  }

  const directRef = doc(FIRESTORE, collectionName, uid);
  const directSnap = await getDoc(directRef);

  if (directSnap.exists()) {
    return { ref: directRef, snap: directSnap, data: directSnap.data() };
  }

  const profileQuery = query(
    collection(FIRESTORE, collectionName),
    where('uid', '==', uid),
    limit(1)
  );
  const querySnap = await getDocs(profileQuery);

  if (querySnap.empty) {
    return null;
  }

  const foundSnap = querySnap.docs[0];

  return { ref: foundSnap.ref, snap: foundSnap, data: foundSnap.data() };
};

export const getAdminProfileRef = async (uid) => getProfileRefByUid(ADMIN_COLLECTION, uid);

export const loadAdminProfile = async (uid) => {
  const adminEntry = await getAdminProfileRef(uid);

  return adminEntry?.data ?? null;
};

export const loadProfileByUid = async (collectionName, uid) => {
  const profileEntry = await getProfileRefByUid(collectionName, uid);

  return profileEntry?.data ?? null;
};

export const findProfileByField = async (collectionName, fieldName, fieldValue) => {
  if (!isFirebaseConfigured || !FIRESTORE) {
    return null;
  }

  const value = String(fieldValue ?? '').trim();

  if (!value) {
    return null;
  }

  const profileQuery = query(
    collection(FIRESTORE, collectionName),
    where(fieldName, '==', value),
    limit(1)
  );
  const querySnap = await getDocs(profileQuery);

  if (querySnap.empty) {
    return null;
  }

  const foundSnap = querySnap.docs[0];

  return { ref: foundSnap.ref, snap: foundSnap, data: foundSnap.data() };
};

export const findAdminProfileByLoginValue = async (loginValue) => {
  if (!isFirebaseConfigured || !FIRESTORE) {
    return null;
  }

  const value = String(loginValue ?? '').trim();

  if (!value) {
    return null;
  }

  const normalizedLogin = value.toLowerCase().replace(/\s+/g, '');
  const normalizedLoginOptions = new Set([
    normalizedLogin,
    normalizedLogin.split('@')[0],
  ]);

  const findInCollection = async (collectionName) => {
    if (value.includes('@')) {
      const emailProfile = await findProfileByField(collectionName, 'correo', value.toLowerCase());

      if (emailProfile) {
        return emailProfile;
      }
    }

    const collectionSnap = await getDocs(collection(FIRESTORE, collectionName));

    const matchedSnapshot = collectionSnap.docs.find((snapshot) => {
      const profile = snapshot.data() ?? {};

      const candidates = [
        profile.codigoUsuario,
        profile.codigoMiembro,
        profile.uid,
        profile.correo,
        profile.nombres,
        profile.apellidos,
      ]
        .filter(Boolean)
        .map((candidate) => String(candidate).trim().toLowerCase().replace(/\s+/g, ''));

      return candidates.some((candidate) => normalizedLoginOptions.has(candidate));
    });

    if (matchedSnapshot) {
      return { ref: matchedSnapshot.ref, snap: matchedSnapshot, data: matchedSnapshot.data() };
    }

    return findProfileByField(collectionName, 'codigoUsuario', value);
  };

  const adminProfile = await findInCollection(ADMIN_COLLECTION);

  if (adminProfile) {
    return adminProfile;
  }

  const userProfile = await findInCollection('users');

  if (userProfile) {
    const role = String(userProfile.data?.rol ?? userProfile.data?.role ?? '').toLowerCase();

    if (role === 'admin' || role === 'administrador') {
      return userProfile;
    }
  }

  return null;
};

export const resolveAdminSignInEmail = async (loginValue) => {
  const value = String(loginValue ?? '').trim().toLowerCase();

  if (!value) return '';

  // Si ya escribió su correo, Firebase puede comprobarlo directamente. Cuando
  // escribe el nombre de usuario (por ejemplo, admin001), la equivalencia con
  // su correo se resuelve en el servidor: `admins` está protegida y no se puede
  // consultar desde una pantalla que todavía no ha iniciado sesión.
  if (value.includes('@')) return value;

  const response = await fetch('/api/auth/correo-acceso-administrador', {
    // Es una consulta previa al acceso, no modifica ninguna ficha. Va por POST
    // para que el usuario administrativo no quede escrito en la URL ni en sus
    // registros intermedios.
    // eslint-disable-next-line no-restricted-syntax
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usuario: value }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload?.error || 'No pudimos comprobar ese usuario de administrador.');
  }

  return String(payload?.correo ?? '').trim().toLowerCase();
};

// EL NOMBRE ES EL DE SU FICHA, NO UNA COPIA VIEJA.
//
// `displayName` es una foto del nombre tomada el dia que se creo la cuenta y
// guardada aparte. Mandaba sobre todo lo demas, asi que una errata de aquel dia
// —o el nombre de antes de casarse, o un apellido que faltaba— se quedaba para
// siempre: corregir la ficha del miembro no cambiaba nada, y ese nombre es el
// que firma sus notificaciones y sus registros.
//
// Ahora manda la ficha. `displayName` sigue detras, para las cuentas de
// administracion que no cuelgan de ningun miembro y solo tienen ese nombre.
export const buildAdminDisplayName = (profile = {}, authUser = {}) => {
  const fullName = [profile.nombres, profile.apellidos].filter(Boolean).join(' ').trim();

  if (fullName) {
    return fullName;
  }

  const explicitDisplayName = profile.displayName?.trim();

  if (explicitDisplayName) {
    return explicitDisplayName;
  }

  if (authUser.displayName?.trim()) {
    return authUser.displayName.trim();
  }

  return authUser.email ?? '';
};

export const buildAdminSessionUser = (authUser, profile = {}) => {
  const displayName = buildAdminDisplayName(profile, authUser);
  const email = profile.correo ?? authUser.email ?? '';
  const photoURL = profile.photoURL ?? authUser.photoURL ?? '';

  return {
    ...authUser,
    ...profile,
    uid: authUser.uid,
    displayName,
    email,
    photoURL,
    role: profile.rol ?? authUser.role ?? 'administrador',
    status: profile.estatus ?? 'activo',
    nombres: profile.nombres ?? '',
    apellidos: profile.apellidos ?? '',
    codigoUsuario: profile.codigoUsuario ?? '',
  };
};
