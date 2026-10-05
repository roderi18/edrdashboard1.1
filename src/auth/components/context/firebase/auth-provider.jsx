'use client';

import { useSetState } from 'minimal-shared/hooks';
import { useRef, useMemo, useEffect, useCallback } from 'react';
import { onIdTokenChanged, signOut as _signOut } from 'firebase/auth';

import { ADMIN_ROLE_IDS } from 'src/utils/admin-role-label';
import { obtenerFotoPrincipal } from 'src/utils/firebase-photos';
import { MEMBER_AUTH_DOMAIN } from 'src/utils/member-auth-credentials';
import { fijarDuenoDeLasLecturas } from 'src/utils/cache-de-lecturas.mjs';
import { SIN_RESPUESTA, conReintentos } from 'src/utils/permisos-con-reintentos.mjs';
import { ENTIDADES_DE_PRUEBA, leerSimulacionDeRoles } from 'src/utils/simulacion-roles';
import {
  buildMemberSessionUser,
  loadMemberAccessProfile,
  buildDefaultMemberPermissions,
} from 'src/utils/member-access';
import {
  loadAdminProfile,
  loadProfileByUid,
  buildAdminSessionUser,
  findAdminProfileByLoginValue,
} from 'src/utils/admin-profile';
import {
  leerVerComoUsuario,
  sinAdministradorGlobal,
  ejerceAdministradorGlobal,
  conAdministradorGlobalAlMando,
} from 'src/utils/administrador-global-reina.mjs';

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
      withTimeout(obtenerAccesoUsuario(candidateId).catch(() => null), SIN_RESPUESTA, 3000)
    )
  );

  const encontrado = accesos.find(
    (access) => access !== SIN_RESPUESTA && (access?.rolId || access?.alcance)
  );

  if (encontrado) return encontrado;

  // El primer candidato es el uid de la cuenta, el documento que de verdad
  // importa. Si ese no contesto a tiempo, "no hay nada" seria mentira: se
  // lanza para que quien llama reintente en vez de dar la sesion por completa.
  if (accesos[0] === SIN_RESPUESTA) {
    throw new Error('permisos-sin-respuesta');
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
    selectorRolAdminGlobal: access.selectorRolAdminGlobal === true,
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
    // TODOS SUS ROLES DE ADMINISTRACION y la lista plana que leen los guardas.
    // Esta funcion copia solo los campos de esta lista, y estos dos no estaban:
    // con Oficina Nacional y Tienda a la vez, la sesion solo veia el principal
    // (Oficina Nacional) y la tienda no aparecia (Eliezer Garcia).
    rolesAdministracion: [
      ...new Set([
        ...(Array.isArray(access.rolesAdministracion) ? access.rolesAdministracion : []),
        ...(Array.isArray(memberProfile.rolesAdministracion) ? memberProfile.rolesAdministracion : []),
      ]),
    ],
    rolesQueEjerce: [
      ...new Set([
        ...(Array.isArray(access.rolesQueEjerce) ? access.rolesQueEjerce : []),
        ...(Array.isArray(memberProfile.rolesQueEjerce) ? memberProfile.rolesQueEjerce : []),
      ]),
    ],
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
// La cuenta administrativa antigua llega con `role: 'admin'` y sin el código.
const ejerceAdministradorGlobalOAdmin = (usuario) =>
  ejerceAdministradorGlobal(usuario) ||
  String(usuario?.role ?? usuario?.rol ?? '')
    .trim()
    .toLowerCase() === 'admin';

const aplicarSimulacionDeRoles = (usuario) => {
  // Antes que la prueba: el Administrador Global reina sobre sus otros cargos
  // (`administrador-global-reina.mjs`). La prueba, si está encendida, sustituye
  // rol y cargos después, así que sigue probando lo que tiene que probar.
  // "Ver como usuario" (panel de la cuenta) le quita el Administrador Global en
  // esta pestaña, para ver lo que ven los demás.
  const user =
    leerVerComoUsuario() && ejerceAdministradorGlobalOAdmin(usuario)
      ? sinAdministradorGlobal(usuario, {
          permisosPorRol: PERMISOS_POR_ROL,
          alcancePorRol: ALCANCE_PREDETERMINADO_ROL,
          restriccionesPorRol: RESTRICCIONES_ROL,
        })
      : conAdministradorGlobalAlMando(usuario);
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
    // En su lugar, los de CUALQUIER miembro (blog, chat, tienda, archivos,
    // calendario…), y lo del cargo sale del catalogo de los dos. Vacio, el menu
    // lateral solo dejaba Inicio, Niveles organizacionales y Asistencia —lo que
    // decide el catalogo—, y la prueba no se parecia a lo que ve esa persona.
    permisos: buildDefaultMemberPermissions(),
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
    // Quien prueba es el Administrador Global, y el menu lateral sigue siendo el
    // suyo durante la prueba (`layouts/dashboard/layout.jsx`); lo que cambia es
    // lo que dejan hacer los guardas de cada pantalla.
    sesionSinPrueba: conAdministradorGlobalAlMando(usuario),
  };
};

/**
 * NOTE:
 * We only build demo at basic level.
 * Customer will need to do some extra handling yourself if you want to extend the logic and other features...
 */

export function AuthProvider({ children }) {
  const { state, setState } = useSetState({
    user: null,
    loading: true,
    // ¿Ya se resolvieron los cargos y permisos de esta sesion? `loading` se apaga
    // con la primera pasada (la pantalla ya puede pintarse), pero lo que depende
    // de un cargo no debe decidir hasta que esto sea true.
    permisosListos: false,
    // Se agotaron los reintentos y la sesion sigue sin sus permisos completos.
    permisosIncompletos: false,
  });

  // La ultima sesion RESUELTA (sin prueba de roles encima) y de quien es. Sirve
  // para que revalidar el token no la pise con la version a medias: antes, cada
  // `onIdTokenChanged` publicaba primero la sesion minima y las opciones de
  // administrador desaparecian hasta que llegara el refinamiento (o para siempre
  // si este fallaba).
  const sesionResueltaRef = useRef({ uid: null, base: null, listos: false });

  const publicarSesion = useCallback(
    (base, { listos, incompletos = false }) => {
      sesionResueltaRef.current = {
        uid: base?.uid ?? null,
        base,
        // Una sesion marcada incompleta NO cuenta como resuelta: si no, revalidar
        // el token la conservaria tal cual en vez de volver a intentar completarla.
        listos: listos && !incompletos,
      };

      setState({
        user: aplicarSimulacionDeRoles(base),
        loading: false,
        permisosListos: listos,
        permisosIncompletos: incompletos,
      });

      // Solo se guarda lo COMPLETO. Guardar la sesion a medias la dejaba pegada
      // hasta 30 minutos: recargar la rehidrataba tal cual, sin las opciones.
      if (listos && !incompletos) writeCachedSession(base);
    },
    [setState]
  );

  const syncUserSession = useCallback(
    async (authUser) => {
      // De quién es lo guardado en la caché de lecturas: los miembros y las
      // listas salen acotados al alcance de cada cuenta, así que otra cuenta en
      // el mismo navegador empieza de cero (memoria y disco).
      fijarDuenoDeLasLecturas(authUser?.uid || null);

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
        // Los permisos tampoco pueden quedarse "resolviendo" para siempre: se
        // liberan, pero marcados como incompletos si no estaban ya resueltos.
        setState({
          loading: false,
          permisosListos: true,
          permisosIncompletos: !sesionResueltaRef.current.listos,
        });
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
          const [memberAccessCrudo, adminProfileByUid] = await Promise.all([
            withTimeout(loadMemberAccessProfile(authUser), SIN_RESPUESTA),
            withTimeout(loadAdminProfile(authUser.uid), null),
          ]);
          // Pasarse de tiempo NO es lo mismo que no ser miembro (`null`): lo
          // primero se reintenta en el refinamiento; lo segundo es un hecho.
          const miembroSinRespuesta = memberAccessCrudo === SIN_RESPUESTA;
          const memberAccessResult = miembroSinRespuesta ? null : memberAccessCrudo;
          // Lo que sabe la sesion del perfil de miembro. Puede completarse en un
          // reintento, y por eso es `let`.
          let memberAccess = memberAccessResult ?? {};
          // Una sesion ya resuelta de ESTA misma cuenta (cache o entrada anterior):
          // revalidar el token no debe rebajarla a la version minima.
          const sesionPrevia =
            sesionResueltaRef.current.listos && sesionResueltaRef.current.uid === authUser.uid
              ? sesionResueltaRef.current.base
              : null;
          // Otra cuenta entro o se cerro la sesion mientras se reintentaba.
          const sigueVigente = () => AUTH?.currentUser?.uid === authUser.uid;
          // Pide de nuevo el perfil de miembro si la primera vez no contesto.
          const completarPerfilDeMiembro = async () => {
            if (!miembroSinRespuesta || memberAccess?.profile) return;

            const reintento = await withTimeout(loadMemberAccessProfile(authUser), SIN_RESPUESTA, 8000);

            if (reintento === SIN_RESPUESTA) throw new Error('perfil-de-miembro-sin-respuesta');

            memberAccess = reintento ?? {};
          };
          const adminProfile =
            adminProfileByUid ??
            (await withTimeout(findAdminProfileByLoginValue(authUser.email), null)) ??
            null;
          let sessionUser;

          if (adminProfile) {
            const adminProfileData = getAdminProfileData(adminProfile);
            // SU IDENTIDAD DE MIEMBRO VIAJA CON LA SESION, TAMBIEN AQUI.
            //
            // Esta rama se armaba solo con el documento de administrador, y ese
            // documento no siempre lleva `idMiembros` —los antiguos no lo tienen—.
            // La rama de miembro si lo resuelve, cayendo a `member.id`, asi que el
            // mismo usuario tenia identidad al entrar como miembro y la perdia al
            // entrar como administrador.
            //
            // Se notaba en el muro: dar un me gusta o comentar exige saber QUIEN
            // lo hace (`assertPrincipalIdentity`), y a un administrador le
            // respondia "tu sesion no tiene una identidad de miembro valida".
            //
            // El documento de administrador sigue mandando; esto solo rellena lo
            // que le falte, con lo que ya se leyo del padron.
            // Es una funcion porque el perfil de miembro puede completarse en un
            // reintento, y la identidad se recalcula con lo que llegue.
            const identidadDeMiembro = () =>
              Object.fromEntries(
                Object.entries({
                  // Sus roles de administracion (el documento de `admins` no los lleva).
                  rolesAdministracion: memberAccess?.profile?.rolesAdministracion,
                  rolesQueEjerce: memberAccess?.profile?.rolesQueEjerce,
                  // Pase de un solo uso: el documento de administrador no lo lleva, y
                  // sin el la sesion de Oficina Nacional entraba al panel sin elegir
                  // contraseña. Lo dice el perfil de miembro.
                  debeCambiarClave:
                    adminProfileData.debeCambiarClave === true ||
                    memberAccess?.profile?.debeCambiarClave === true,
                  idMiembros:
                    adminProfileData.idMiembros ??
                    memberAccess?.profile?.idMiembros ??
                    memberAccess?.member?.id ??
                    memberAccess?.member?.idMiembros,
                  codigoMiembro:
                    adminProfileData.codigoMiembro ??
                    memberAccess?.profile?.codigoMiembro ??
                    memberAccess?.member?.memberId,
                }).filter(([, valor]) => Boolean(valor))
              );

            // La identidad de Firebase y el perfil administrativo bastan para
            // entrar al panel. No se espera la foto ni la lectura de permisos
            // adicionales: el dashboard pinta su skeleton y se refina detrás.
            const sesionInicial = buildAdminSessionUser(authUser, {
              ...adminProfileData,
              ...identidadDeMiembro(),
            });

            // Con una sesion ya resuelta de esta cuenta se conserva (solo renueva
            // el token): publicar la minima haria desaparecer las opciones hasta
            // que el refinamiento volviera a llegar.
            if (sesionPrevia) {
              publicarSesion({ ...sesionPrevia, accessToken }, { listos: true });
            } else {
              publicarSesion({ ...sesionInicial, accessToken }, { listos: false });
            }

            // El perfil completo llega después: permisos, cargos combinados y
            // foto no deben formar parte de la ruta crítica de entrada.
            //
            // Con reintentos: antes un tiempo agotado se tragaba en silencio y la
            // sesion se quedaba sin cargos (y sin las opciones de administrador).
            window.setTimeout(() => {
              conReintentos(async () => {
                await completarPerfilDeMiembro();

                const [authorizationAccess, adminSessionWithPhoto] = await Promise.all([
                  loadAuthorizationAccess(authUser, adminProfileData, memberAccess),
                  buildAdminSessionWithMemberPhoto(authUser, {
                    ...adminProfileData,
                    ...identidadDeMiembro(),
                  }),
                ]);

                return {
                  ...adminSessionWithPhoto,
                  ...pickAuthorizationProfile(authorizationAccess, memberAccess),
                  ...identidadDeMiembro(),
                  accessToken,
                };
              }, { sigueVigente })
                .then((sesionRefinada) => {
                  if (sesionRefinada) publicarSesion(sesionRefinada, { listos: true });
                })
                .catch((error) => {
                  console.warn('[sesion] no se pudieron completar los permisos', error);

                  // Si ya habia una sesion completa, esa sigue valiendo. Si no, se
                  // avisa: callar era justo lo que dejaba la pantalla "a medias".
                  if (!sesionPrevia && sigueVigente()) {
                    publicarSesion(sesionResueltaRef.current.base ?? sesionInicial, {
                      listos: true,
                      incompletos: true,
                    });
                  }
                });
            }, 900);

            window.setTimeout(() => sincronizarRolPorCargo(accessToken).catch(() => {}), 1800);
            return;
          } else if (memberAccess?.profile || memberAccess?.member || isMemberAuth) {
            // PINTAR YA, REFINAR DESPUES.
            //
            // La sesion de un miembro ya esta COMPLETA con lo que traen sus
            // cargos: su rol, sus permisos y su alcance salen de ahi.
            // `loadAuthorizationAccess` solo anade lo que un administrador le
            // haya concedido a mano, que casi nunca es nada — y esperarlo son
            // hasta tres segundos mirando un splash.
            //
            // Asi que se publica la sesion con lo que ya se sabe y la pantalla
            // arranca; si el refinamiento trae algo, se publica otra vez encima.
            // Es el mismo dato al final, pero la aplicacion ya se esta usando.
            const armarSesion = (accesoDeAutorizacion) => {
              const perfilDeAutorizacion = pickAuthorizationProfile(
                accesoDeAutorizacion,
                memberAccess
              );
              const accesoCombinado = {
                ...memberAccess,
                profile: { ...(memberAccess.profile ?? {}), ...perfilDeAutorizacion },
              };
              // Se leen de `memberAccess` AHORA, no del primer intento: si el perfil
              // llego en un reintento, el rol de administrador viene en el.
              const rolActual = memberAccess.profile?.rol ?? memberAccess.profile?.role;
              const rolIdActual =
                memberAccess.profile?.rolId ??
                memberAccess.profile?.roleId ??
                memberAccess.profile?.rolCodigo ??
                memberAccess.profile?.roleCodigo;

              return isAdminRole(rolActual) ||
                isAdminRoleId(rolIdActual) ||
                isAdminRoleId(perfilDeAutorizacion.rolId)
                ? buildAdminSessionFromMemberAccess(authUser, accesoCombinado)
                : buildMemberSessionUser(authUser, accesoCombinado);
            };

            const publicar = (usuario, opciones) =>
              publicarSesion({ ...usuario, accessToken }, opciones);

            if (sesionPrevia) {
              publicar(sesionPrevia, { listos: true });
            } else {
              publicar(armarSesion(null), { listos: false });
            }

            // Y por detras, sin que nadie espere.
            // Al terminar, se relee el perfil: la sincronizacion puede cambiar el rol
            // (p. ej. rescatar una Oficina Nacional dada antes de tener cuenta) y,
            // sin releerlo, la sesion seguia con el de antes hasta recargar.
            window.setTimeout(
              () =>
                sincronizarRolPorCargo(accessToken)
                  .then(() => loadAuthorizationAccess(authUser, memberAccess?.profile, memberAccess))
                  .then((acceso) => {
                    if (acceso?.rolId || acceso?.alcance) {
                      publicar(armarSesion(acceso), { listos: true });
                    }
                  })
                  .catch(() => {}),
              1800
            );

            // Con reintentos, y SIEMPRE se publica al terminar (aunque no haya
            // autorizacion extra): es lo que marca los permisos como resueltos.
            window.setTimeout(() => {
              conReintentos(async () => {
                await completarPerfilDeMiembro();

                return loadAuthorizationAccess(authUser, memberAccess?.profile, memberAccess);
              }, { sigueVigente })
                .then((acceso) => {
                  if (acceso === undefined && !sigueVigente()) return;

                  publicar(armarSesion(acceso), { listos: true });
                })
                .catch((error) => {
                  console.warn('[sesion] no se pudieron completar los permisos', error);

                  if (!sesionPrevia && sigueVigente()) {
                    publicarSesion(sesionResueltaRef.current.base, {
                      listos: true,
                      incompletos: true,
                    });
                  }
                });
            }, 900);

            return;
          } else if (isSocialAuthUser(authUser)) {
            await _signOut(AUTH).catch(() => {});
            sesionResueltaRef.current = { uid: null, base: null, listos: false };
            setState({
              user: null,
              loading: false,
              permisosListos: false,
              permisosIncompletos: false,
            });
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
          publicarSesion(resolvedUser, { listos: true });

          return;
        }

        sesionResueltaRef.current = { uid: null, base: null, listos: false };
        setState({
          user: null,
          loading: false,
          permisosListos: false,
          permisosIncompletos: false,
        });
        writeCachedSession(null);
        delete axios.defaults.headers.common.Authorization;
      } catch (error) {
        console.error(error);
        sesionResueltaRef.current = { uid: null, base: null, listos: false };
        setState({
          user: null,
          loading: false,
          permisosListos: false,
          permisosIncompletos: false,
        });
        writeCachedSession(null);
      } finally {
        clearTimeout(red);
      }
    },
    [setState, publicarSesion]
  );

  // Hidratación instantánea desde el caché (una sola vez, en cliente): evita el
  // splash "Verificando tu acceso" en las recargas. onIdTokenChanged revalida
  // enseguida y corrige/renueva el token o cierra la sesión si ya no es válida.
  useEffect(() => {
    if (!isFirebaseConfigured || !AUTH) return;

    const cachedUser = readCachedSession();

    if (cachedUser) {
      // Solo se cachean sesiones completas, asi que esta ya tiene sus permisos.
      sesionResueltaRef.current = { uid: cachedUser.uid ?? null, base: cachedUser, listos: true };
      setState({
        user: aplicarSimulacionDeRoles(cachedUser),
        loading: false,
        permisosListos: true,
        permisosIncompletos: false,
      });
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
      // Cargos y permisos ya resueltos. `loading` solo dice que hay sesion; esto,
      // que se puede decidir que opciones mostrar. Antes de ser true, lo que
      // depende de un cargo espera (esqueleto) en vez de ocultarse.
      permisosListos: state.permisosListos,
      // Se agotaron los reintentos: la sesion funciona pero puede faltarle algo.
      permisosIncompletos: state.permisosIncompletos,
    }),
    [checkUserSession, state.user, state.permisosListos, state.permisosIncompletos, status]
  );

  return <AuthContext value={memoizedValue}>{children}</AuthContext>;
}
