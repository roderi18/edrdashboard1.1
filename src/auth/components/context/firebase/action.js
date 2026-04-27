'use client';

import { doc, setDoc, collection } from 'firebase/firestore';
import {
  updateProfile,
  signOut as _signOut,
  signInWithPopup as _signInWithPopup,
  GoogleAuthProvider as _GoogleAuthProvider,
  GithubAuthProvider as _GithubAuthProvider,
  TwitterAuthProvider as _TwitterAuthProvider,
  sendEmailVerification as _sendEmailVerification,
  sendPasswordResetEmail as _sendPasswordResetEmail,
  signInWithEmailAndPassword as _signInWithEmailAndPassword,
  createUserWithEmailAndPassword as _createUserWithEmailAndPassword,
} from 'firebase/auth';

import { AUTH, FIRESTORE } from 'src/lib/firebase';

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

const getEmailVerificationSettings = () => ({
  url:
    typeof window !== 'undefined'
      ? `${window.location.origin}/auth/firebase/sign-in?forceSignOut=1`
      : '/auth/firebase/sign-in?forceSignOut=1',
  handleCodeInApp: false,
});

/** **************************************
 * Sign in
 *************************************** */
export const signInWithPassword = async ({ email, password }) => {
  try {
    const userCredential = await _signInWithEmailAndPassword(AUTH, email, password);

    return userCredential.user;
  } catch (error) {
    if (!expectedAuthErrorCodes.includes(error?.code)) {
      console.error('Error during sign in with password:', error);
    }

    throw error;
  }
};

export const signInWithGoogle = async () => {
  const provider = new _GoogleAuthProvider();
  await _signInWithPopup(AUTH, provider);
};

export const signInWithGithub = async () => {
  const provider = new _GithubAuthProvider();
  await _signInWithPopup(AUTH, provider);
};

export const signInWithTwitter = async () => {
  const provider = new _TwitterAuthProvider();
  await _signInWithPopup(AUTH, provider);
};

/** **************************************
 * Sign up
 *************************************** */
export const signUp = async ({ email, password, firstName, lastName }) => {
  try {
    const newUser = await _createUserWithEmailAndPassword(AUTH, email, password);
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

export const resendEmailVerification = async () => {
  const user = AUTH.currentUser;

  if (!user) {
    throw new Error('Debes iniciar sesión para reenviar el enlace de verificación.');
  }

  await withTimeout(
    _sendEmailVerification(user, getEmailVerificationSettings()),
    'Resend email verification'
  );
};

/** **************************************
 * Sign out
 *************************************** */
export const signOut = async () => {
  await _signOut(AUTH);
};

/** **************************************
 * Reset password
 *************************************** */
export const sendPasswordResetEmail = async ({ email }) => {
  await _sendPasswordResetEmail(AUTH, email);
};
