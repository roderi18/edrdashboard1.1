'use client';

import { onAuthStateChanged } from 'firebase/auth';
import { useSetState } from 'minimal-shared/hooks';
import { useMemo, useEffect, useCallback } from 'react';

import { MEMBER_AUTH_DOMAIN } from 'src/utils/member-auth-credentials';
import { buildMemberSessionUser, loadMemberAccessProfile } from 'src/utils/member-access';
import { loadAdminProfile, loadProfileByUid, buildAdminSessionUser } from 'src/utils/admin-profile';

import axios from 'src/lib/axios';
import { AUTH } from 'src/lib/firebase';

import { AuthContext } from '../auth-context';

// ----------------------------------------------------------------------

const withTimeout = (promise, fallback, timeoutMs = 5000) =>
  Promise.race([
    promise,
    new Promise((resolve) => {
      setTimeout(() => resolve(fallback), timeoutMs);
    }),
  ]);

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

          const sessionUser = isMemberAuth
            ? buildMemberSessionUser(
                authUser,
                (await withTimeout(loadMemberAccessProfile(authUser), null)) ?? {}
              )
            : buildAdminSessionUser(
                authUser,
                (await withTimeout(loadAdminProfile(authUser.uid), null)) ??
                  (await withTimeout(loadProfileByUid('users', authUser.uid), null)) ??
                  {}
              );

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
    const unsubscribe = onAuthStateChanged(AUTH, (authUser) => {
      syncUserSession(authUser);
    });

    return unsubscribe;
  }, [syncUserSession]);

  const checkUserSession = useCallback(async () => {
    await syncUserSession(AUTH.currentUser ?? null);
  }, [syncUserSession]);

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
