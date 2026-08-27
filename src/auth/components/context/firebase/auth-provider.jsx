'use client';

import { useSetState } from 'minimal-shared/hooks';
import { useMemo, useEffect, useCallback } from 'react';
import { onIdTokenChanged, signOut as _signOut } from 'firebase/auth';

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
import {
  mergeCombinedRoleScope,
  mergeCombinedRolePermissions,
} from 'src/auth/permissions/combined-role-access';

import { AuthContext } from '../auth-context';

// ----------------------------------------------------------------------

const withTimeout = (promise, fallback, timeoutMs = 5000) =>
  Promise.race([
    promise,
    new Promise((resolve) => {
      setTimeout(() => resolve(fallback), timeoutMs);
    }),
  ]);

// ----------------------------------------------------------------------
// Caché de sesión (por pestaña) para que las recargas pinten el dashboard al
// instante mientras onIdTokenChanged revalida en segundo plano. No se
// persiste el accessToken: se refresca al revalidar.

const SESSION_CACHE_KEY = 'edr-auth-session';
const SESSION_CACHE_TTL_MS = 30 * 60 * 1000; // 30 min

const readCachedSession = () => {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.sessionStorage.getItem(SESSION_CACHE_KEY);

    if (!raw) return null;

    const parsed = JSON.parse(raw);

    if (!parsed?.user || !parsed?.cachedAt || Date.now() - parsed.cachedAt > SESSION_CACHE_TTL_MS) {
      window.sessionStorage.removeItem(SESSION_CACHE_KEY);
      return null;
    }

    return parsed.user;
  } catch {
    return null;
  }
};

const writeCachedSession = (user) => {
  if (typeof window === 'undefined') return;

  try {
    if (!user) {
      window.sessionStorage.removeItem(SESSION_CACHE_KEY);
      return;
    }

    // Se descarta el token a propósito: no se persiste en almacenamiento.
    // eslint-disable-next-line no-unused-vars
    const { accessToken, ...safeUser } = user;

    window.sessionStorage.setItem(
      SESSION_CACHE_KEY,
      JSON.stringify({ user: safeUser, cachedAt: Date.now() })
    );
  } catch {
    // Almacenamiento no disponible (modo privado, cuota, etc.): se ignora.
  }
};

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

const unirCargos = (...listas) => {
  const porCodigo = new Map();

  listas.flat().forEach((cargo) => {
    if (!cargo) return;

    const codigo = String(cargo?.rol ?? cargo?.rolId ?? cargo?.codigo ?? '')
      .trim()
      .toLowerCase();

    if (!codigo || porCodigo.has(codigo)) return;

    porCodigo.set(codigo, cargo);
  });

  return [...porCodigo.values()];
};

const pickAuthorizationProfile = (access = {}, memberAccess = {}) => {
  if (!access) return {};

  // El rol deducido del cargo en la directiva viaja en el perfil del miembro. Si
  // el documento de autorizacion no trae uno propio, se conserva ese en vez de
  // vaciarlo: sin esto la sesion se quedaba sin rolId y el usuario aparecia como
  // Usuario Comun aunque ocupara una casilla del organigrama.
  const roleId = access.rolId || access.roleId || memberAccess?.profile?.rolId || '';
  const roleScopeType =
    access?.rol?.alcancePredeterminado || ALCANCE_PREDETERMINADO_ROL[roleId] || '';
  const memberProfile = memberAccess?.profile ?? {};
  const alcance = mergeCombinedRoleScope(access.alcance, memberAccess, roleScopeType);

  return {
    rolId: roleId,
    roleId,
    rolNombre: access.rolNombre || access.rol?.nombre || '',
    alcance,
    // La autorización persistida puede representar solo el rol principal. Los
    // cargos resueltos desde la directiva conservan sus permisos y restricciones
    // contextuales para que uno de sección no anule al de destacamento.
    // Los cargos de la directiva Y los que traiga la autorizacion, sin repetir.
    // Antes ganaba uno u otro: si el perfil del miembro traia los suyos, una
    // combinacion asignada a mano —la que usa el Administrador Global para
    // probar— no llegaba a los guardas.
    cargos: unirCargos(memberProfile.cargos, access.cargos),
    // Prueba de roles en curso (la enciende el Administrador Global).
    simulacion: access.simulacion ?? null,
    restricciones: {
      ...(access.restricciones ?? {}),
      ...(memberProfile.restricciones ?? {}),
    },
    permisosRol: mergeCombinedRolePermissions(
      access.rol?.permisos,
      access.permisosRol,
      memberProfile.permisosRol
    ),
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
          writeCachedSession(null);
          delete axios.defaults.headers.common.Authorization;
          return;
        }

        if (authUser) {
          const accessToken =
            authUser.accessToken ??
            authUser.stsTokenManager?.accessToken ??
            (await authUser.getIdToken?.()) ??
            null;

          // La interfaz puede hidratarse desde sessionStorage antes de completar
          // los perfiles. Instalar el token inmediatamente evita que las primeras
          // consultas autenticadas (por ejemplo, contactos de chat) salgan en 401.
          if (accessToken) {
            axios.defaults.headers.common.Authorization = `Bearer ${accessToken}`;
          }

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

            const combinedMemberAccess = {
              ...memberAccess,
              profile: {
                ...(memberAccess.profile ?? {}),
                ...authorizationProfile,
              },
            };

            sessionUser =
              isAdminRole(memberRole) ||
              isAdminRoleId(memberRoleId) ||
              isAdminRoleId(authorizationProfile.rolId)
                ? buildAdminSessionFromMemberAccess(authUser, combinedMemberAccess)
                : buildMemberSessionUser(authUser, combinedMemberAccess);
          } else if (isSocialAuthUser(authUser)) {
            await _signOut(AUTH).catch(() => {});
            setState({ user: null, loading: false });
            writeCachedSession(null);
            delete axios.defaults.headers.common.Authorization;
            return;
          } else {
            sessionUser = buildAdminSessionUser(
              authUser,
              (await withTimeout(loadProfileByUid('users', authUser.uid), null)) ?? {}
            );
          }

          const resolvedUser = { ...sessionUser, accessToken };
          setState({ user: resolvedUser, loading: false });
          writeCachedSession(resolvedUser);

          return;
        }

        setState({ user: null, loading: false });
        writeCachedSession(null);
        delete axios.defaults.headers.common.Authorization;
      } catch (error) {
        console.error(error);
        setState({ user: null, loading: false });
        writeCachedSession(null);
      }
    },
    [setState]
  );

  // Hidratación instantánea desde el caché (una sola vez, en cliente): evita el
  // splash "Verificando tu acceso" en las recargas. onIdTokenChanged revalida
  // enseguida y corrige/renueva el token o cierra la sesión si ya no es válida.
  useEffect(() => {
    if (!isFirebaseConfigured || !AUTH) return;

    const cachedUser = readCachedSession();

    if (cachedUser) {
      setState({ user: cachedUser, loading: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isFirebaseConfigured || !AUTH) {
      setState({ user: null, loading: false });
      writeCachedSession(null);
      delete axios.defaults.headers.common.Authorization;
      return undefined;
    }

    const unsubscribe = onIdTokenChanged(AUTH, (authUser) => {
      syncUserSession(authUser);
    });

    return unsubscribe;
  }, [setState, syncUserSession]);

  const checkUserSession = useCallback(async () => {
    if (!isFirebaseConfigured || !AUTH) {
      setState({ user: null, loading: false });
      writeCachedSession(null);
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
