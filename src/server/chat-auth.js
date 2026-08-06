import 'server-only';

import { getAdminDb, getAdminAuth, isAdminConfigured } from 'src/server/firebase-admin';

import {
  getChatMemberDirectory,
  resolveDirectoryIdentityProfiles,
} from './chat-identity-directory.mjs';
import {
  isFirebaseRestAuthConfigured,
  createFirebaseRestIdentityProvider,
} from './firebase-auth-rest.mjs';
import {
  CHAT_AUTH_CODES,
  ChatAuthenticationError,
  createCachedChatAuthenticator,
  createChatRequestAuthenticator,
} from './chat-auth-core.mjs';

export {
  CHAT_AUTH_CODES,
  ChatAuthenticationError,
  bindAuthenticatedMessage,
  bindAuthenticatedConversation,
  assertAuthenticatedConversationParticipant,
} from './chat-auth-core.mjs';

const PROFILE_COLLECTIONS = ['usuarios_roles', 'users', 'admins'];
const UID_FIELDS = ['uid', 'idUsuario'];
const EMAIL_FIELDS = ['correo', 'email'];

let restIdentityProvider = null;

const getRestIdentityProvider = () => {
  if (!restIdentityProvider) {
    restIdentityProvider = createFirebaseRestIdentityProvider({
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    });
  }

  return restIdentityProvider;
};

const isChatAuthenticationConfigured = () => isAdminConfigured() || isFirebaseRestAuthConfigured();

const hasMemberId = (profiles = []) =>
  profiles.some((profile) => {
    const idMiembros = Number(profile?.idMiembros ?? profile?.memberId);

    return Number.isSafeInteger(idMiembros) && idMiembros > 0;
  });

const profileFromSnapshot = (collectionName, snapshot) => ({
  collection: collectionName,
  id: snapshot.id,
  ...(snapshot.data() ?? {}),
});

const addSnapshot = (profiles, seen, collectionName, snapshot) => {
  if (!snapshot?.exists) return;

  const key = `${collectionName}/${snapshot.id}`;

  if (seen.has(key)) return;

  seen.add(key);
  profiles.push(profileFromSnapshot(collectionName, snapshot));
};

const addQuerySnapshot = (profiles, seen, collectionName, querySnapshot) => {
  querySnapshot?.docs?.forEach((snapshot) => addSnapshot(profiles, seen, collectionName, snapshot));
};

const loadIdentityProfiles = async ({ uid, email }) => {
  const db = getAdminDb();
  const profiles = [];
  const seen = new Set();

  await Promise.all(
    PROFILE_COLLECTIONS.map(async (collectionName) => {
      const collectionRef = db.collection(collectionName);
      const [directSnapshot, ...uidSnapshots] = await Promise.all([
        collectionRef.doc(uid).get(),
        ...UID_FIELDS.map((fieldName) => collectionRef.where(fieldName, '==', uid).limit(2).get()),
      ]);

      addSnapshot(profiles, seen, collectionName, directSnapshot);
      uidSnapshots.forEach((snapshot) =>
        addQuerySnapshot(profiles, seen, collectionName, snapshot)
      );
    })
  );

  if (!hasMemberId(profiles) && email) {
    await Promise.all(
      PROFILE_COLLECTIONS.map(async (collectionName) => {
        const collectionRef = db.collection(collectionName);
        const emailSnapshots = await Promise.all(
          EMAIL_FIELDS.map((fieldName) =>
            collectionRef.where(fieldName, '==', email).limit(2).get()
          )
        );

        emailSnapshots.forEach((snapshot) =>
          addQuerySnapshot(profiles, seen, collectionName, snapshot)
        );
      })
    );
  }

  return profiles;
};

const enrichProfilesFromMemberDirectory = async ({ decodedToken, profiles }) => {
  if (hasMemberId(profiles)) return profiles;

  const directoryProfiles = resolveDirectoryIdentityProfiles({
    decodedToken,
    profiles,
    members: await getChatMemberDirectory(),
  });

  return [...profiles, ...directoryProfiles];
};

const loadChatIdentityProfiles = async (identity) => {
  const profiles = isAdminConfigured()
    ? await loadIdentityProfiles(identity)
    : await getRestIdentityProvider().loadIdentityProfiles(identity);

  return enrichProfilesFromMemberDirectory({
    decodedToken: identity.decodedToken,
    profiles,
  });
};

const authenticateChatRequestUncached = createChatRequestAuthenticator({
  isConfigured: isChatAuthenticationConfigured,
  verifyIdToken: async (token) => {
    if (!isAdminConfigured()) {
      return getRestIdentityProvider().verifyIdToken(token);
    }

    let adminAuth;

    try {
      adminAuth = getAdminAuth();
    } catch (error) {
      throw new ChatAuthenticationError('La credencial Firebase Admin del servidor no es válida.', {
        status: 503,
        code: CHAT_AUTH_CODES.SERVER_NOT_CONFIGURED,
        cause: error,
      });
    }

    return adminAuth.verifyIdToken(token, true);
  },
  loadIdentityProfiles: loadChatIdentityProfiles,
});

// El chat genera señales frecuentes (escritura, entrega y lectura). Reutilizar
// brevemente una identidad ya verificada evita repetir accounts:lookup y hasta
// quince lecturas de perfil para cada señal, sin almacenar sesiones persistentes.
export const authenticateChatRequest = createCachedChatAuthenticator({
  authenticate: authenticateChatRequestUncached,
  ttlMs: 5 * 60_000,
  maxEntries: 500,
});

export const chatAuthenticationErrorResponse = (error) => {
  if (!(error instanceof ChatAuthenticationError)) return null;

  return Response.json(
    {
      message: error.message,
      code: error.code,
    },
    { status: error.status }
  );
};
