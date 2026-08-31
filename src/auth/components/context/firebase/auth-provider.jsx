'use client';

import { useSetState } from 'minimal-shared/hooks';
import { useMemo, useEffect, useCallback } from 'react';
import { onIdTokenChanged, signOut as _signOut } from 'firebase/auth';

import { ADMIN_ROLE_IDS } from 'src/utils/admin-role-label';
import { obtenerFotoPrincipal } from 'src/utils/firebase-photos';
import { MEMBER_AUTH_DOMAIN } from 'src/utils/member-auth-credentials';
import { ENTIDADES_DE_PRUEBA, leerSimulacionDeRoles } from 'src/utils/simulacion-roles';
import { buildMemberSessionUser, loadMemberAccessProfile } from 'src/utils/member-access';
import {
  loadAdminProfile,
  loadProfileByUid,
  buildAdminSessionUser,
  findAdminProfileByLoginValue,
} from 'src/utils/admin-profile';

import axios from 'src/lib/axios';
import { AUTH, isFirebaseConfigured } from 'src/lib/firebase';
import { rolPrincipalDe, ROL_COMBINABLE_POR_CODIGO } from 'src/catalogs/combinaciones-roles';

import { PERMISOS_POR_ROL, RESTRICCIONES_ROL } from 'src/auth/permissions/role-permissions';
import {
  mergeCombinedRoleScope,
  mergeCombinedRolePermissions,
} from 'src/auth/permissions/combined-role-access';
import {
  obtenerAccesoUsuario,
  sincronizarRolPorCargo,
  ALCANCE_PREDETERMINADO_ROL,
} from 'src/auth/permissions';

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

  // EN PARALELO, NO EN FILA.
  //
  // Se probaba identificador por identificador, esperando a cada uno antes de
  // pedir el siguiente: hasta ONCE lecturas encadenadas, cada una con su propio
  // tope de cinco segundos. Con que un par tardaran, el arranque se iba a
  // decenas de segundos —y ninguna de esas esperas dependia de la anterior—.
  //
  // Se piden todas a la vez y se queda la primera que responda algo, en el mismo
  // orden de preferencia que tenia el bucle. Un tope mas corto: cada una es la
  // lectura de un documento, no un calculo.
  const accesos = await Promise.all(
    candidateIds.map((candidateId) =>
      withTimeout(obtenerAccesoUsuario(candidateId).catch(() => null), null, 3000)
    )
  );

  return accesos.find((access) => access?.rolId || access?.alcance) ?? null;
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
 * Le cuenta al SERVIDOR que cargo ocupa quien acaba de entrar.
 *
 * La sesion deduce el rol de sus casillas en la directiva, pero eso vivia solo
 * aqui: en Firestore la mayoria de las cuentas no tenian `rolId`, y las reglas
 * —que preguntan por `usuarios_roles/<uid>`— no encontraban ni el documento. Por
 * ahi se caia, por ejemplo, subir la foto de un miembro del propio destacamento:
 * la pantalla lo ofrecia y el servidor lo rechazaba.
 *
 * Va sin `await` y sin recargar nada: no cambia lo que ya se ve, solo alinea al
 * servidor. Una vez por carga de sesion.
 */
/**
 * La PRUEBA de dos cargos del Administrador Global, encima de su sesion.
 *
 * Solo cambia lo que miran los guardas —rol principal, cargos, permisos del
 * catalogo, alcance y solo lectura—; su identidad (uid, correo, token) se queda
 * como esta. No se persiste en ningun sitio: vive en la pestaña, asi que apagarla
 * o cerrarla devuelve al Administrador Global sin depender de que la base de
 * datos le deje escribir su propio rol.
 */
const aplicarSimulacionDeRoles = (user) => {
  const simulacion = leerSimulacionDeRoles();

  if (!user || !simulacion) return user;

  const deDestacamento = ROL_COMBINABLE_POR_CODIGO[simulacion.rolDestacamento];
  const acompanante = ROL_COMBINABLE_POR_CODIGO[simulacion.rolAcompanante];

  if (!deDestacamento || !acompanante) return user;

  const cargos = [deDestacamento, acompanante];
  const principal = rolPrincipalDe(cargos);
  const permisosRol = [...new Set(cargos.flatMap((rol) => PERMISOS_POR_ROL[rol.codigo] ?? []))];
  const soloLectura = cargos.every((rol) => RESTRICCIONES_ROL[rol.codigo]?.soloLectura === true);

  // La pareja se ejerce EN un sitio: el destacamento de prueba, con su seccion y
  // su region. Sin entidad, el alcance sale vacio y las listas aparecen en
  // blanco en vez de enseñar lo que veria esa persona.
  const idEntidadDe = (nivel) =>
    ({
      destacamento: ENTIDADES_DE_PRUEBA.destacamento.id,
      seccion: ENTIDADES_DE_PRUEBA.seccion.id,
      region: ENTIDADES_DE_PRUEBA.region.id,
    })[nivel] ?? '';

  return {
    ...user,
    rolId: principal.codigo,
    roleId: principal.codigo,
    rolNombre: principal.nombre,
    // Pertenece al destacamento de prueba mientras dure.
    idDestacamento: ENTIDADES_DE_PRUEBA.destacamento.id,
    destId: ENTIDADES_DE_PRUEBA.destacamento.id,
    // `role`/`rol` dicen 'admin' en la sesion del Administrador Global, y por ahi
    // se colaba de vuelta el mando: durante la prueba pasan a ser el rol probado.
    role: principal.codigo,
    rol: principal.codigo,
    memberRole: principal.codigo,
    cargos: cargos.map((rol) => ({
      rol: rol.codigo,
      nivel: rol.nivel,
      idEntidad: idEntidadDe(rol.nivel),
      nombreCargo: rol.nombre,
    })),
    permisosRol,
    // Los permisos sueltos de su cuenta de administrador no cuentan durante la
    // prueba: si contaran, seguiria pudiendo todo y la prueba no probaria nada.
    // Vacio como OBJETO, que es lo que espera `getMemberPermissions`: asi las
    // comprobaciones caen en el catalogo de los dos cargos, que es la respuesta
    // correcta, en vez de en un objeto de permisos que no existe.
    permisos: {},
    permisosDirectos: [],
    permisosAutorizacion: [],
    permisosExcluidos: [],
    restricciones: { soloLectura },
    alcance: {
      tipo: principal.alcance,
      modo: principal.alcance,
      destacamentoId: ENTIDADES_DE_PRUEBA.destacamento.id,
      idDestacamento: ENTIDADES_DE_PRUEBA.destacamento.id,
      destacamentos: [ENTIDADES_DE_PRUEBA.destacamento.id],
      // La seccion y la region solo entran en el alcance si ejerce un cargo de
      // ese nivel: si no, veria de mas.
      ...(cargos.some((rol) => rol.nivel === 'seccion')
        ? {
            seccionId: ENTIDADES_DE_PRUEBA.seccion.id,
            idSeccion: ENTIDADES_DE_PRUEBA.seccion.id,
            secciones: [ENTIDADES_DE_PRUEBA.seccion.id],
          }
        : { secciones: [] }),
      ...(cargos.some((rol) => rol.nivel === 'region')
        ? {
            regionId: ENTIDADES_DE_PRUEBA.region.id,
            idRegion: ENTIDADES_DE_PRUEBA.region.id,
            regiones: [ENTIDADES_DE_PRUEBA.region.id],
          }
        : { regiones: [] }),
    },
    simulacion: { activa: true, ...simulacion },
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
      // RED DE SEGURIDAD. Esta funcion es la unica que apaga `loading`, y la
      // pantalla espera a que lo haga: si algo de aqui dentro no vuelve —una
      // promesa que no resuelve, no que falle—, el usuario se queda mirando
      // "Verificando tu acceso" sin error, sin pista y sin salida.
      //
      // Pasados 8 segundos se libera la pantalla con lo que haya. Es preferible
      // una sesion a medias, que la aplicacion sabe manejar, a una espera que no
      // termina nunca.
      const red = setTimeout(() => {
        console.warn('[sesion] la resolucion tardó demasiado; se libera la pantalla');
        setState({ loading: false });
      }, 8000);

      try {
        if (!isFirebaseConfigured || !AUTH) {
          setState({ user: null, loading: false });
          writeCachedSession(null);
          delete axios.defaults.headers.common.Authorization;
          return;
        }

        if (authUser) {
          // `getIdToken()` NO se espera sin tope: cuando el token ya no vale
          // —al cambiar la contraseña, el servidor tira las sesiones anteriores—
          // Firebase se queda reintentando el refresco, y con el se quedaba
          // colgada la resolucion entera de la sesion: "Verificando tu acceso"
          // para siempre, sin error y sin nada que mirar.
          const accessToken =
            authUser.accessToken ??
            authUser.stsTokenManager?.accessToken ??
            (await withTimeout(authUser.getIdToken?.(), null, 5000)) ??
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

          // Sin `await`: alinea al servidor con el cargo que esta sesion ya
          // resolvio, y no cambia nada de lo que se ve.
          sincronizarRolPorCargo(accessToken).catch(() => {});

          // Se guarda en el cache la sesion DE VERDAD, sin la prueba encima: la
          // prueba se aplica al leerla. Cacheandola ya simulada, apagarla no
          // devolvia el mando —la recarga rehidrataba con el rol probado— hasta
          // que Firebase revalidaba.
          setState({ user: aplicarSimulacionDeRoles(resolvedUser), loading: false });
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
      } finally {
        clearTimeout(red);
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
      setState({ user: aplicarSimulacionDeRoles(cachedUser), loading: false });
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
