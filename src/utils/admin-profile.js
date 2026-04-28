import { doc, limit, query, where, getDoc, getDocs, collection } from 'firebase/firestore';

import { FIRESTORE } from 'src/lib/firebase';

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
  const value = String(loginValue ?? '').trim();

  if (!value) {
    return null;
  }

  if (value.includes('@')) {
    return findProfileByField(ADMIN_COLLECTION, 'correo', value.toLowerCase());
  }

  const normalizedLogin = value.toLowerCase().replace(/\s+/g, '');
  const collectionSnap = await getDocs(collection(FIRESTORE, ADMIN_COLLECTION));

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

  if (!matchedSnapshot) {
    return findProfileByField(ADMIN_COLLECTION, 'codigoUsuario', value);
  }

  return { ref: matchedSnapshot.ref, snap: matchedSnapshot, data: matchedSnapshot.data() };
};

export const resolveAdminSignInEmail = async (loginValue) => {
  const profile = await findAdminProfileByLoginValue(loginValue);

  if (profile?.data?.correo) {
    return String(profile.data.correo).trim().toLowerCase();
  }

  return String(loginValue ?? '').trim().toLowerCase().includes('@')
    ? String(loginValue ?? '').trim().toLowerCase()
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
