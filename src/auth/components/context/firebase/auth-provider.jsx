'use client';

import { onAuthStateChanged } from 'firebase/auth';
import { useSetState } from 'minimal-shared/hooks';
import { useMemo, useEffect, useCallback } from 'react';

import { obtenerFotoPrincipal } from 'src/utils/firebase-photos';
import { MEMBER_AUTH_DOMAIN } from 'src/utils/member-auth-credentials';
import { buildMemberSessionUser, loadMemberAccessProfile } from 'src/utils/member-access';
import {
  loadAdminProfile,
  loadProfileByUid,
  buildAdminSessionUser,
  findAdminProfileByLoginValue,
} from 'src/utils/admin-profile';

import axios from 'src/lib/axios';
import { AUTH, isFirebaseConfigured } from 'src/lib/firebase';

import { AuthContext } from '../auth-context';

// ----------------------------------------------------------------------

const withTimeout = (promise, fallback, timeoutMs = 5000) =>
  Promise.race([
    promise,
    new Promise((resolve) => {
      setTimeout(() => resolve(fallback), timeoutMs);
    }),
  ]);

const isAdminRole = (role) =>
  ['admin', 'administrador'].includes(String(role ?? '').trim().toLowerCase());

const buildAdminSessionFromMemberAccess = (authUser, access = {}) => {
  const member = access.member ?? {};
  const profile = access.profile ?? {};

  return buildAdminSessionUser(authUser, {
    ...member,
    ...profile,
    rol: 'administrador',
    estatus: profile.estado ?? profile.estatus ?? member.status ?? 'activo',
    nombres: member.firstName ?? profile.nombres ?? '',
    apellidos: member.lastName ?? profile.apellidos ?? '',
    correo: profile.correo ?? member.email ?? authUser.email ?? '',
    codigoUsuario:
      profile.codigoUsuario ?? profile.codigoMiembro ?? member.memberId ?? member.codigoMiembro ?? '',
    codigoMiembro: profile.codigoMiembro ?? member.memberId ?? member.codigoMiembro ?? '',
    idMiembros: Number(profile.idMiembros ?? member.id ?? member.idMiembros ?? 0) || '',
    photoURL: profile.photoURL ?? member.avatarUrl ?? authUser.photoURL ?? '',
  });
};

const getIdentityKeys = (values = []) =>
  values
    .filter(Boolean)
    .flatMap((value) => {
      const normalizedValue = String(value).trim().toLowerCase();
      const emailUser = normalizedValue.includes('@') ? normalizedValue.split('@')[0] : '';

      return [normalizedValue, emailUser].filter(Boolean);
    });

const getAdminMemberPhotoFromContacts = async (profile = {}, authUser = {}) => {
  if (typeof window === 'undefined') {
    return '';
  }

  const response = await fetch(`${window.location.origin}/api/chat/?endpoint=contacts`, {
    cache: 'no-store',
  }).catch(() => null);

  if (!response?.ok) {
    return '';
  }

  const data = await response.json().catch(() => ({}));
  const contacts = Array.isArray(data.contacts) ? data.contacts : [];
  const profileKeys = getIdentityKeys([
    profile.idMiembros,
    profile.memberId,
    profile.codigoMiembro,
    profile.codigoUsuario,
    profile.correo,
    profile.email,
    authUser.email,
    authUser.uid,
  ]);

  const contact = contacts.find((item) =>
    getIdentityKeys([
      item.idMiembros,
      item.id,
      item.memberId,
      item.codigoMiembro,
      item.codigoUsuario,
      item.correo,
      item.email,
    ]).some((value) => profileKeys.includes(value))
  );

  return contact?.avatarUrl || '';
};

const buildAdminSessionWithMemberPhoto = async (authUser, profile = {}) => {
  const adminProfile = profile.data ?? profile;
  const idMiembros = adminProfile.idMiembros ?? adminProfile.memberId;
  const memberPhoto = idMiembros
    ? await withTimeout(
        obtenerFotoPrincipal({ tipoEntidad: 'miembro', idEntidad: idMiembros }),
        null
      )
    : null;
  const contactPhotoURL = memberPhoto?.urlFoto
    ? ''
    : await withTimeout(getAdminMemberPhotoFromContacts(adminProfile, authUser), '');

  return buildAdminSessionUser(authUser, {
    ...adminProfile,
    photoURL:
      memberPhoto?.urlFoto || contactPhotoURL || adminProfile.photoURL || adminProfile.avatarUrl || '',
  });
};

/**
 * NOTE:
 * We only build demo at basic level.
 * Customer will need to do some extra handling yourself if you want to extend the logic and other features...
 */

export function AuthProvider({ children }) {
  const { state, setState } = useSetState({ user: null, loading: true });

  const syncUserSession = useCallback(
    async (authUser) => {
      try {
        if (!isFirebaseConfigured || !AUTH) {
          setState({ user: null, loading: false });
          delete axios.defaults.headers.common.Authorization;
          return;
        }

        if (authUser) {
          const accessToken =
            authUser.accessToken ??
            authUser.stsTokenManager?.accessToken ??
            (await authUser.getIdToken?.()) ??
            null;

          const email = String(authUser.email ?? '')
            .trim()
            .toLowerCase();
          const isMemberAuth = email.endsWith(`@${MEMBER_AUTH_DOMAIN}`);
          const adminProfile =
            (await withTimeout(loadAdminProfile(authUser.uid), null)) ??
            (await withTimeout(findAdminProfileByLoginValue(authUser.email), null)) ??
            null;

          let sessionUser;

          if (adminProfile) {
            sessionUser = await buildAdminSessionWithMemberPhoto(authUser, adminProfile);
          } else if (isMemberAuth) {
            const memberAccess = (await withTimeout(loadMemberAccessProfile(authUser), null)) ?? {};
            const memberRole = memberAccess.profile?.rol ?? memberAccess.profile?.role;

            sessionUser = isAdminRole(memberRole)
              ? buildAdminSessionFromMemberAccess(authUser, memberAccess)
              : buildMemberSessionUser(authUser, memberAccess);
          } else {
            sessionUser = buildAdminSessionUser(
              authUser,
              (await withTimeout(loadProfileByUid('users', authUser.uid), null)) ?? {}
            );
          }

          setState({ user: { ...sessionUser, accessToken }, loading: false });

          if (accessToken) {
            axios.defaults.headers.common.Authorization = `Bearer ${accessToken}`;
          }

          return;
        }

        setState({ user: null, loading: false });
        delete axios.defaults.headers.common.Authorization;
      } catch (error) {
        console.error(error);
        setState({ user: null, loading: false });
      }
    },
    [setState]
  );

  useEffect(() => {
    if (!isFirebaseConfigured || !AUTH) {
      setState({ user: null, loading: false });
      delete axios.defaults.headers.common.Authorization;
      return undefined;
    }

    const unsubscribe = onAuthStateChanged(AUTH, (authUser) => {
      syncUserSession(authUser);
    });

    return unsubscribe;
  }, [setState, syncUserSession]);

  const checkUserSession = useCallback(async () => {
    if (!isFirebaseConfigured || !AUTH) {
      setState({ user: null, loading: false });
      delete axios.defaults.headers.common.Authorization;
      return;
    }

    await syncUserSession(AUTH.currentUser ?? null);
  }, [setState, syncUserSession]);

  // ----------------------------------------------------------------------

  const checkAuthenticated = state.user ? 'authenticated' : 'unauthenticated';

  const status = state.loading ? 'loading' : checkAuthenticated;

  const memoizedValue = useMemo(
    () => ({
      user: state.user
        ? {
            ...state.user,
            id: state.user?.uid,
            accessToken: state.user?.accessToken,
            displayName: state.user?.displayName,
            photoURL: state.user?.photoURL,
            role: state.user?.role ?? 'admin',
          }
        : null,
      checkUserSession,
      loading: status === 'loading',
      authenticated: status === 'authenticated',
      unauthenticated: status === 'unauthenticated',
    }),
    [checkUserSession, state.user, status]
  );

  return <AuthContext value={memoizedValue}>{children}</AuthContext>;
}
