'use client';

import { doc, setDoc, collection } from 'firebase/firestore';
import {
  updateProfile,
  unlink as _unlink,
  signOut as _signOut,
  linkWithPopup as _linkWithPopup,
  signInWithPopup as _signInWithPopup,
  GoogleAuthProvider as _GoogleAuthProvider,
  GithubAuthProvider as _GithubAuthProvider,
  TwitterAuthProvider as _TwitterAuthProvider,
  sendEmailVerification as _sendEmailVerification,
  signInWithCustomToken as _signInWithCustomToken,
  sendPasswordResetEmail as _sendPasswordResetEmail,
  signInWithEmailAndPassword as _signInWithEmailAndPassword,
  createUserWithEmailAndPassword as _createUserWithEmailAndPassword,
} from 'firebase/auth';

import { AUTH, FIRESTORE, isFirebaseConfigured } from 'src/lib/firebase';

// ----------------------------------------------------------------------

const withTimeout = (promise, label, timeoutMs = 10000) =>
  Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out`)), timeoutMs);
    }),
  ]);

const expectedAuthErrorCodes = [
  'auth/invalid-credential',
  'auth/user-not-found',
  'auth/wrong-password',
  'auth/invalid-email',
];

// A donde vuelve el miembro despues de pulsar el enlace. El alta lo deja en el
// inicio de sesion; quien esta esperando en la pantalla de verificacion vuelve a
// ella, que lo detecta y le abre el panel sin que tenga que hacer nada.
const DESTINO_TRAS_VERIFICAR = '/auth/firebase/sign-in?forceSignOut=1';

const getEmailVerificationSettings = (destino = DESTINO_TRAS_VERIFICAR) => ({
  url: typeof window !== 'undefined' ? `${window.location.origin}${destino}` : destino,
  handleCodeInApp: false,
});

const ensureFirebaseAuth = () => {
  if (!isFirebaseConfigured || !AUTH) {
    throw new Error(
      'Firebase no está configurado en este entorno. Verifica las variables públicas de Firebase en Netlify.'
    );
  }

  return AUTH;
};

/** **************************************
 * Sign in
 *************************************** */
export const signInWithPassword = async ({ email, password }) => {
  try {
    const userCredential = await _signInWithEmailAndPassword(ensureFirebaseAuth(), email, password);

    return userCredential.user;
  } catch (error) {
    if (!expectedAuthErrorCodes.includes(error?.code)) {
      console.error('Error during sign in with password:', error);
    }

    throw error;
  }
};

/**
 * Entrar con un token que emite el servidor.
 *
 * Se usa para el codigo de un solo uso del Coordinador: el miembro no tiene
 * contraseña que dar, asi que el servidor comprueba el codigo y devuelve el
 * token con el que se abre la sesion.
 */
export const signInWithCustomToken = async ({ token }) => {
  const userCredential = await _signInWithCustomToken(ensureFirebaseAuth(), token);

  return userCredential.user;
};

export const signInWithGoogle = async () => {
  const provider = new _GoogleAuthProvider();
  provider.addScope('email');
  provider.addScope('profile');

  const userCredential = await _signInWithPopup(ensureFirebaseAuth(), provider);

  return userCredential.user;
};

export const linkCurrentUserWithGoogle = async () => {
  const user = ensureFirebaseAuth().currentUser;

  if (!user) {
    throw new Error('Debes iniciar sesión antes de vincular Google.');
  }

  const provider = new _GoogleAuthProvider();
  provider.addScope('email');
  provider.addScope('profile');

  const userCredential = await _linkWithPopup(user, provider);

  return userCredential.user;
};

export const unlinkCurrentUserProvider = async (providerId) => {
  const user = ensureFirebaseAuth().currentUser;

  if (!user) {
    throw new Error('Debes iniciar sesión antes de desvincular una cuenta.');
  }

  return _unlink(user, providerId);
};

export const signInWithGithub = async () => {
  const provider = new _GithubAuthProvider();
  await _signInWithPopup(ensureFirebaseAuth(), provider);
};

export const signInWithTwitter = async () => {
  const provider = new _TwitterAuthProvider();
  await _signInWithPopup(ensureFirebaseAuth(), provider);
};

/** **************************************
 * Sign up
 *************************************** */
export const signUp = async ({ email, password, firstName, lastName }) => {
  try {
    const newUser = await _createUserWithEmailAndPassword(ensureFirebaseAuth(), email, password);
    const displayName = `${firstName} ${lastName}`;

    await withTimeout(
      updateProfile(newUser.user, {
        displayName,
      }),
      'Update profile'
    );
    /*
     * (1) If skip emailVerified
     * Remove : await _sendEmailVerification(newUser.user);
     */
    await withTimeout(
      _sendEmailVerification(newUser.user, getEmailVerificationSettings()),
      'Send email verification'
    );

    const userProfile = doc(collection(FIRESTORE, 'users'), newUser.user?.uid);

    withTimeout(
      setDoc(userProfile, {
        uid: newUser.user?.uid,
        email,
        displayName,
      }),
      'Create user profile'
    ).catch((error) => {
      console.warn('User was created in Auth, but profile was not saved in Firestore:', error);
    });

    return newUser.user;
  } catch (error) {
    console.error('Error during sign up:', error);
    throw error;
  }
};

export const resendEmailVerification = async ({ destino } = {}) => {
  const user = ensureFirebaseAuth().currentUser;

  if (!user) {
    throw new Error('Debes iniciar sesión para reenviar el enlace de verificación.');
  }

  await withTimeout(
    _sendEmailVerification(user, getEmailVerificationSettings(destino)),
    'Resend email verification'
  );
};

/** **************************************
 * Sign out
 *************************************** */
export const signOut = async () => {
  await _signOut(ensureFirebaseAuth());
};

/** **************************************
 * Reset password
 *************************************** */
export const sendPasswordResetEmail = async ({ email }) => {
  await _sendPasswordResetEmail(ensureFirebaseAuth(), email);
};
