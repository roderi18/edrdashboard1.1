import { getApp, deleteApp, initializeApp } from 'firebase/app';
import { getAuth, deleteUser, updateProfile, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, collection } from 'firebase/firestore';

import {
  buildMemberAuthEmail,
  buildMemberAuthPassword,
  normalizeMemberUsername,
} from 'src/utils/member-auth-credentials';
import { buildDefaultMemberPermissions } from 'src/utils/member-access';

import { CONFIG } from 'src/global-config';
import { FIRESTORE } from 'src/lib/firebase';

const MEMBER_AUTH_APP_NAME = 'member-auth-provisioning';

const withTimeout = (promise, milliseconds, errorMessage) =>
  Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(errorMessage)), milliseconds);
    }),
  ]);

const createSecondaryAuth = () => {
  try {
    return getAuth(getApp(MEMBER_AUTH_APP_NAME));
  } catch {
    return getAuth(initializeApp(CONFIG.firebase, MEMBER_AUTH_APP_NAME));
  }
};

export const buildMemberAccountProvisioningData = ({
  codigoMiembro,
  firstName,
  lastName,
  destId,
  memberId,
  uid = '',
} = {}) => {
  const username = normalizeMemberUsername(codigoMiembro);

  if (!username) {
    throw new Error('No se puede crear la cuenta sin código de miembro.');
  }

  const emailFake = buildMemberAuthEmail(username);
  const password = buildMemberAuthPassword(username);
  const displayName = `${firstName || ''} ${lastName || ''}`.trim() || codigoMiembro;
  const createdAt = new Date().toISOString();

  return {
    username,
    emailFake,
    password,
    displayName,
    userProfile: {
      uid,
      email: emailFake,
      username,
      codigoMiembro,
      displayName,
      firstName: firstName || '',
      lastName: lastName || '',
      idDestacamento: destId ? Number(destId) : null,
      authMode: 'member-code',
      createdAt,
    },
    roleProfile: {
      idMiembros: memberId ? Number(memberId) : null,
      codigoMiembro,
      uid,
      correo: emailFake,
      nombre: displayName,
      rol: 'miembro',
      estado: 'activo',
      debeCambiarClave: true,
      alcance: {
        modo: 'destacamento',
        destacamentos: destId ? [Number(destId)] : [],
        regiones: [],
        secciones: [],
      },
      permisos: {
        ...buildDefaultMemberPermissions(),
      },
      creadoEn: createdAt,
      actualizadoEn: createdAt,
    },
  };
};

export const createFirebaseAuthForMember = async ({
  codigoMiembro,
  firstName,
  lastName,
  destId,
  memberId,
}) => {
  if (!FIRESTORE) {
    throw new Error('Firebase no está configurado para crear la cuenta de acceso.');
  }

  let secondaryAuth = null;
  let credential = null;

  try {
    const account = buildMemberAccountProvisioningData({
      codigoMiembro,
      firstName,
      lastName,
      destId,
      memberId,
    });

    secondaryAuth = createSecondaryAuth();
    credential = await createUserWithEmailAndPassword(
      secondaryAuth,
      account.emailFake,
      account.password
    );

    const accountWithUid = buildMemberAccountProvisioningData({
      codigoMiembro,
      firstName,
      lastName,
      destId,
      memberId,
      uid: credential.user.uid,
    });
    const [profileResult, userResult, roleResult] = await Promise.allSettled([
      withTimeout(
        updateProfile(credential.user, { displayName: accountWithUid.displayName }),
        5000,
        'No se pudo actualizar el nombre del usuario Firebase.'
      ),
      withTimeout(
        setDoc(
          doc(collection(FIRESTORE, 'users'), credential.user.uid),
          accountWithUid.userProfile
        ),
        5000,
        'No se pudo guardar el perfil extra del usuario Firebase.'
      ),
      withTimeout(
        setDoc(
          doc(collection(FIRESTORE, 'usuarios_roles'), String(memberId || codigoMiembro)),
          accountWithUid.roleProfile
        ),
        5000,
        'No se pudo guardar los permisos base del miembro.'
      ),
    ]);

    if (profileResult.status === 'rejected') {
      console.warn('[member auth] firebase profile update failed', profileResult.reason);
    }

    const requiredFailure = [userResult, roleResult].find((result) => result.status === 'rejected');

    if (requiredFailure) {
      await deleteUser(credential.user).catch((cleanupError) => {
        console.warn('[member auth] could not roll back incomplete account', cleanupError);
      });
      credential = null;
      throw requiredFailure.reason;
    }

    return {
      uid: accountWithUid.userProfile.uid,
      emailFake: accountWithUid.emailFake,
      username: accountWithUid.username,
      password: accountWithUid.password,
    };
  } finally {
    if (secondaryAuth?.app) {
      await deleteApp(secondaryAuth.app).catch(() => {});
    }
  }
};
