'use client';

import { useSetState } from 'minimal-shared/hooks';
import { useMemo, useEffect, useCallback } from 'react';
import { onAuthStateChanged, signOut as _signOut } from 'firebase/auth';

import { ADMIN_ROLE_IDS } from 'src/utils/admin-role-label';
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

import { obtenerAccesoUsuario, ALCANCE_PREDETERMINADO_ROL } from 'src/auth/permissions';

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

const isAdminRoleId = (roleId) => ADMIN_ROLE_IDS.includes(String(roleId ?? '').trim());

const SOCIAL_PROVIDER_IDS = new Set(['google.com', 'apple.com', 'facebook.com']);

const isSocialAuthUser = (authUser) =>
  Array.isArray(authUser?.providerData) &&
  authUser.providerData.some((provider) => SOCIAL_PROVIDER_IDS.has(provider?.providerId));

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
    rolId: profile.rolId ?? profile.roleId ?? '',
    roleId: profile.roleId ?? profile.rolId ?? '',
    rolNombre: profile.rolNombre ?? profile.roleName ?? '',
    alcance: profile.alcance ?? {},
    permisosRol: profile.permisosRol ?? [],
    permisosDirectos: profile.permisosDirectos ?? [],
    permisosExcluidos: profile.permisosExcluidos ?? [],
    permisosMetadata: profile.permisosMetadata ?? {},
    permisosAutorizacion: profile.permisosAutorizacion ?? [],
  });
};

const buildAdminSessionWithMemberPhoto = async (authUser, profile = {}) => {
  const adminProfile = getAdminProfileData(profile);
  const idMiembros = adminProfile.idMiembros ?? adminProfile.memberId;
  const memberPhoto = idMiembros
    ? await withTimeout(
        obtenerFotoPrincipal({ tipoEntidad: 'miembro', idEntidad: idMiembros }),
        null
      )
    : null;

  return buildAdminSessionUser(authUser, {
    ...adminProfile,
    photoURL: memberPhoto?.urlFoto || adminProfile.photoURL || adminProfile.avatarUrl || '',
  });
};

const getAdminProfileData = (profile = {}) => {
  const profileData = profile?.data ?? profile;

  return {
    ...profileData,
    id: profile?.snap?.id || profile?.ref?.id || profileData?.id || profile?.id || '',
  };
};

const normalizeScopeList = (...values) =>
  values
    .flat()
    .filter((value) => value !== null && value !== undefined && value !== '')
    .map((value) => (Number.isFinite(Number(value)) ? Number(value) : String(value)));

const uniqueScopeList = (...values) => Array.from(new Set(normalizeScopeList(...values)));

const getScopeType = (scope = {}, fallback = '') => scope?.tipo || scope?.modo || fallback;

const mergeDestScopeWithMemberAccess = (scope = {}, memberAccess = {}, fallbackScopeType = '') => {
  const memberScope = memberAccess?.profile?.alcance ?? {};
  const scopeType = getScopeType(scope, fallbackScopeType || getScopeType(memberScope));

  if (scopeType !== 'destacamento') {
    return {
      ...memberScope,
      ...scope,
      ...(scopeType ? { tipo: scopeType, modo: scopeType } : {}),
    };
  }

  const destacamentos = uniqueScopeList(
    scope?.destacamentos,
    scope?.destacamentoId,
    scope?.idDestacamento,
    memberScope?.destacamentos,
    memberScope?.destacamentoId,
    memberScope?.idDestacamento,
    memberAccess?.member?.idDestacamento
  );
  const secciones = uniqueScopeList(
    scope?.secciones,
    scope?.seccionId,
    scope?.idSeccion,
    memberScope?.secciones,
    memberScope?.seccionId,
    memberScope?.idSeccion
  );
  const primaryDestId =
    scope?.destacamentoId ??
    scope?.idDestacamento ??
    memberScope?.destacamentoId ??
    memberScope?.idDestacamento ??
    destacamentos[0] ??
    '';

  return {
    ...memberScope,
    ...scope,
    tipo: scopeType,
    modo: scopeType,
    destacamentoId: primaryDestId,
    idDestacamento: scope?.idDestacamento ?? scope?.destacamentoId ?? primaryDestId,
    destacamentos,
    seccionId: scope?.seccionId ?? scope?.idSeccion ?? memberScope?.seccionId ?? memberScope?.idSeccion ?? secciones[0] ?? '',
    idSeccion: scope?.idSeccion ?? scope?.seccionId ?? memberScope?.idSeccion ?? memberScope?.seccionId ?? secciones[0] ?? '',
    secciones,
  };
};

const getAuthorizationCandidateIds = (authUser = {}, profile = {}, memberAccess = {}) =>
  Array.from(
    new Set(
      [
        authUser?.uid,
        getAdminProfileData(profile)?.id,
        getAdminProfileData(profile)?.uid,
        getAdminProfileData(profile)?.idUsuario,
        getAdminProfileData(profile)?.idMiembros,
        getAdminProfileData(profile)?.memberId,
        getAdminProfileData(profile)?.codigoMiembro,
        getAdminProfileData(profile)?.codigoUsuario,
        memberAccess?.profile?.uid,
        memberAccess?.profile?.idMiembros,
        memberAccess?.profile?.codigoMiembro,
      ]
        .filter((value) => value !== null && value !== undefined && value !== '')
        .map(String)
    )
  );

const loadAuthorizationAccess = async (authUser, profile, memberAccess) => {
  const candidateIds = getAuthorizationCandidateIds(authUser, profile, memberAccess);

  for (const candidateId of candidateIds) {
    const access = await withTimeout(obtenerAccesoUsuario(candidateId).catch(() => null), null);

    if (access?.rolId || access?.alcance) {
      return access;
    }
  }

  return null;
};

const pickAuthorizationProfile = (access = {}, memberAccess = {}) => {
  if (!access) return {};

  const roleId = access.rolId || access.roleId || '';
  const roleScopeType =
    access?.rol?.alcancePredeterminado || ALCANCE_PREDETERMINADO_ROL[roleId] || '';
  const alcance = mergeDestScopeWithMemberAccess(access.alcance, memberAccess, roleScopeType);

  return {
    rolId: roleId,
    roleId,
    rolNombre: access.rolNombre || access.rol?.nombre || '',
    alcance,
    restricciones: access.restricciones || {},
    permisosRol: access.rol?.permisos || access.permisosRol || [],
    permisosDirectos: access.permisosDirectos || [],
    permisosExcluidos: access.permisosExcluidos || [],
    permisosMetadata: access.permisosMetadata || {},
    permisosAutorizacion: Array.isArray(access.permisos) ? access.permisos : [],
  };
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

          // Lookups independientes en paralelo para no apilar timeouts secuenciales.
          const [memberAccessResult, adminProfileByUid] = await Promise.all([
            withTimeout(loadMemberAccessProfile(authUser), null),
            withTimeout(loadAdminProfile(authUser.uid), null),
          ]);
          const memberAccess = memberAccessResult ?? {};
          const adminProfile =
            adminProfileByUid ??
            (await withTimeout(findAdminProfileByLoginValue(authUser.email), null)) ??
            null;
          const memberRole = memberAccess.profile?.rol ?? memberAccess.profile?.role;
          const memberRoleId =
            memberAccess.profile?.rolId ??
            memberAccess.profile?.roleId ??
            memberAccess.profile?.rolCodigo ??
            memberAccess.profile?.roleCodigo;

          let sessionUser;

          if (adminProfile) {
            const adminProfileData = getAdminProfileData(adminProfile);
            const authorizationAccess =
              (await loadAuthorizationAccess(authUser, adminProfileData, memberAccess)) ??
              memberAccess?.profile ??
              null;

            sessionUser = await buildAdminSessionWithMemberPhoto(authUser, {
              ...adminProfileData,
              ...pickAuthorizationProfile(authorizationAccess, memberAccess),
            });
          } else if (memberAccess?.profile || memberAccess?.member || isMemberAuth) {
            const authorizationAccess = await loadAuthorizationAccess(
              authUser,
              memberAccess?.profile,
              memberAccess
            );
            const authorizationProfile = pickAuthorizationProfile(authorizationAccess, memberAccess);

            sessionUser =
              isAdminRole(memberRole) || isAdminRoleId(memberRoleId) || isAdminRoleId(authorizationProfile.rolId)
                ? buildAdminSessionFromMemberAccess(authUser, {
                    ...memberAccess,
                    profile: {
                      ...(memberAccess.profile ?? {}),
                      ...authorizationProfile,
                    },
                  })
                : buildMemberSessionUser(authUser, memberAccess);
          } else if (isSocialAuthUser(authUser)) {
            await _signOut(AUTH).catch(() => {});
            setState({ user: null, loading: false });
            delete axios.defaults.headers.common.Authorization;
            return;
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
