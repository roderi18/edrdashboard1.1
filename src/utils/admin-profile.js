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
        profile.uid,
        profile.correo,
        profile.nombres,
        profile.apellidos,
      ]
        .filter(Boolean)
        .map((candidate) => String(candidate).trim().toLowerCase().replace(/\s+/g, ''));

      return candidates.includes(normalizedLogin);
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

    if (!role || role === 'admin' || role === 'administrador') {
      return userProfile;
    }
  }

  return null;
};

export const resolveAdminSignInEmail = async (loginValue) => {
  const profile = await findAdminProfileByLoginValue(loginValue);

  if (profile?.data?.correo) {
    return String(profile.data.correo).trim().toLowerCase();
  }

  return String(loginValue ?? '')
    .trim()
    .toLowerCase()
    .includes('@')
    ? String(loginValue ?? '')
        .trim()
        .toLowerCase()
    : '';
};

export const buildAdminDisplayName = (profile = {}, authUser = {}) => {
  const explicitDisplayName = profile.displayName?.trim();

  if (explicitDisplayName) {
    return explicitDisplayName;
  }

  const fullName = [profile.nombres, profile.apellidos].filter(Boolean).join(' ').trim();

  if (fullName) {
    return fullName;
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
    role: profile.rol ?? authUser.role ?? 'admin',
    status: profile.estatus ?? 'activo',
    nombres: profile.nombres ?? '',
    apellidos: profile.apellidos ?? '',
    codigoUsuario: profile.codigoUsuario ?? '',
  };
};
