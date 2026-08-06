const PROFILE_COLLECTIONS = ['usuarios_roles', 'users', 'admins'];
const UID_FIELDS = ['uid', 'idUsuario'];
const EMAIL_FIELDS = ['correo', 'email'];

const normalizeText = (value) => String(value ?? '').trim();

const readJson = async (response) => {
  const text = await response.text();

  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const firestoreValueToJs = (value = {}) => {
  if ('nullValue' in value) return null;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return Number(value.doubleValue);
  if ('timestampValue' in value) return value.timestampValue;
  if ('stringValue' in value) return value.stringValue;
  if ('referenceValue' in value) return value.referenceValue;
  if ('geoPointValue' in value) return value.geoPointValue;
  if ('bytesValue' in value) return value.bytesValue;
  if ('arrayValue' in value) {
    return (value.arrayValue?.values ?? []).map(firestoreValueToJs);
  }
  if ('mapValue' in value) {
    return firestoreFieldsToJs(value.mapValue?.fields ?? {});
  }

  return undefined;
};

const firestoreFieldsToJs = (fields = {}) =>
  Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, firestoreValueToJs(value)])
  );

export const firestoreDocumentToProfile = (document = {}, collection = '') => {
  const pathParts = String(document.name ?? '').split('/');

  return {
    collection,
    id: pathParts.at(-1) ?? '',
    ...firestoreFieldsToJs(document.fields ?? {}),
  };
};

const hasMemberId = (profiles = []) =>
  profiles.some((profile) => {
    const memberId = Number(profile?.idMiembros ?? profile?.memberId);

    return Number.isSafeInteger(memberId) && memberId > 0;
  });

export const isFirebaseRestAuthConfigured = (env = process.env) =>
  Boolean(
    normalizeText(env.NEXT_PUBLIC_FIREBASE_API_KEY) &&
      normalizeText(env.NEXT_PUBLIC_FIREBASE_PROJECT_ID)
  );

export const createFirebaseRestIdentityProvider = ({
  apiKey,
  projectId,
  fetchImpl = fetch,
} = {}) => {
  if (!normalizeText(apiKey) || !normalizeText(projectId) || typeof fetchImpl !== 'function') {
    throw new TypeError('La autenticacion Firebase REST requiere apiKey, projectId y fetch.');
  }

  const firestoreBaseUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    projectId
  )}/databases/(default)/documents`;

  const authorizedFetch = (url, token, init = {}) =>
    fetchImpl(url, {
      ...init,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init.headers ?? {}),
      },
      cache: 'no-store',
    });

  const verifyIdToken = async (token) => {
    const response = await fetchImpl(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: token }),
        cache: 'no-store',
      }
    );
    const payload = await readJson(response);
    const firebaseUser = payload?.users?.[0];

    if (!response.ok || !firebaseUser?.localId) {
      throw new Error(payload?.error?.message || 'Firebase rechazo el token.');
    }

    let customClaims = {};

    try {
      customClaims = firebaseUser.customAttributes
        ? JSON.parse(firebaseUser.customAttributes)
        : {};
    } catch {
      customClaims = {};
    }

    return {
      ...customClaims,
      uid: firebaseUser.localId,
      email: firebaseUser.email ?? '',
    };
  };

  const getDirectProfile = async (collection, uid, token) => {
    const response = await authorizedFetch(
      `${firestoreBaseUrl}/${encodeURIComponent(collection)}/${encodeURIComponent(uid)}`,
      token
    );

    if (response.status === 404) return null;

    const payload = await readJson(response);

    if (!response.ok) {
      throw new Error(payload?.error?.message || `No se pudo leer ${collection}/${uid}.`);
    }

    return firestoreDocumentToProfile(payload, collection);
  };

  const queryProfiles = async (collection, fieldPath, value, token) => {
    const response = await authorizedFetch(`${firestoreBaseUrl}:runQuery`, token, {
      method: 'POST',
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: collection }],
          where: {
            fieldFilter: {
              field: { fieldPath },
              op: 'EQUAL',
              value: { stringValue: value },
            },
          },
          limit: 2,
        },
      }),
    });
    const payload = await readJson(response);

    if (!response.ok) {
      throw new Error(payload?.error?.message || `No se pudo consultar ${collection}.${fieldPath}.`);
    }

    return (Array.isArray(payload) ? payload : [])
      .map((item) => item.document)
      .filter(Boolean)
      .map((document) => firestoreDocumentToProfile(document, collection));
  };

  const loadIdentityProfiles = async ({ uid, email, token }) => {
    const profiles = [];
    const seen = new Set();
    const addProfiles = (candidates = []) => {
      candidates.filter(Boolean).forEach((profile) => {
        const key = `${profile.collection}/${profile.id}`;

        if (!seen.has(key)) {
          seen.add(key);
          profiles.push(profile);
        }
      });
    };

    const settleProfiles = async (requests) => {
      const results = await Promise.allSettled(requests);

      return results
        .filter((result) => result.status === 'fulfilled')
        .map((result) => result.value);
    };

    const directProfiles = await settleProfiles(
      PROFILE_COLLECTIONS.map((collection) => getDirectProfile(collection, uid, token))
    );
    addProfiles(directProfiles);

    if (!hasMemberId(profiles)) {
      const uidProfiles = await settleProfiles(
        PROFILE_COLLECTIONS.flatMap((collection) =>
          UID_FIELDS.map((field) => queryProfiles(collection, field, uid, token))
        )
      );
      uidProfiles.forEach(addProfiles);
    }

    if (!hasMemberId(profiles) && email) {
      const emailProfiles = await settleProfiles(
        PROFILE_COLLECTIONS.flatMap((collection) =>
          EMAIL_FIELDS.map((field) => queryProfiles(collection, field, email, token))
        )
      );
      emailProfiles.forEach(addProfiles);
    }

    return profiles;
  };

  return { verifyIdToken, loadIdentityProfiles };
};
