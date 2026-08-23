import { doc, limit, query, where, getDoc, setDoc, getDocs, collection } from 'firebase/firestore';

import { paths } from 'src/routes/paths';

import {
  isAdminGlobal,
  isOficinaNacional,
  puedeEntrarAAdministracion,
} from 'src/utils/org-level-access';

import { getMembers } from 'src/services/member-service';
import { FIRESTORE, isFirebaseConfigured } from 'src/lib/firebase';
import { DIRECTIVA_LEVELS } from 'src/catalogs/directiva-positions';
import {
  ROLES_ASIGNADOS_A_MANO,
  resolverRolesPorAsignaciones,
} from 'src/catalogs/directiva-roles';
import { obtenerAsignacionesDirectivaPorMiembro } from 'src/services/directivas-organizacionales-service';

import { PERMISOS } from 'src/auth/permissions/permissions';
import { can, isReadOnlyRole, puedeModificar } from 'src/auth/permissions/can';
import { ROLES, ALCANCES, ROLES_POR_CODIGO } from 'src/auth/permissions/roles';
import { getAssignedDestIds } from 'src/auth/permissions/combined-role-access';
import {
  PERMISOS_POR_ROL,
  RESTRICCIONES_ROL,
  ALCANCE_PREDETERMINADO_ROL,
} from 'src/auth/permissions/role-permissions';

import { normalizeText } from './normalize-text';
import { loadProfileByUid } from './admin-profile';
import { EDAD_MAYORIA, getMemberAge } from './member-age';
import { MEMBER_AUTH_DOMAIN, normalizeMemberUsername } from './member-auth-credentials';

// ----------------------------------------------------------------------

// La edad vive en `member-age` (modulo puro, sin Firebase); se reexporta aqui
// para no romper a quien ya la importaba desde member-access.
export { EDAD_MAYORIA, getMemberAge };

export const isMemberSessionUser = (user) =>
  Boolean(user) && user?.role !== 'admin' && user?.role !== 'administrador';

const isAdminSessionUser = (user) =>
  ['admin', 'administrador'].includes(String(user?.role ?? user?.rol ?? '').trim().toLowerCase());

export const getMemberPermissions = (user) => user?.permisos ?? user?.permissions ?? {};

export const getMemberScope = (user) => user?.alcance ?? {};

export const getMemberCodeLabel = (user) =>
  String(user?.codigoMiembro ?? user?.memberId ?? user?.codigo ?? '')
    .trim()
    .toUpperCase();

// El correo de autenticación de los miembros es generado (usuario@exploradores.app)
// y NO es un correo real. Este helper detecta ese caso.
const isMemberAuthEmail = (email) =>
  String(email || '')
    .trim()
    .toLowerCase()
    .endsWith(`@${MEMBER_AUTH_DOMAIN}`);

// Correo real del usuario (vacío si solo tiene el correo de autenticación falso).
export const getRealMemberEmail = (user = {}) => {
  const email = String(user?.email ?? '').trim();
  return isMemberAuthEmail(email) ? '' : email;
};

// Código del miembro para mostrar. Usa codigoMiembro/memberId; si faltan pero el
// correo es el de autenticación (usuario@exploradores.app), lo deriva del usuario
// del correo (p. ej. do-sd-111111041 -> DO-SD-111111041).
export const getMemberCodeForDisplay = (user = {}) => {
  const code = getMemberCodeLabel(user);
  if (code) return code;

  const email = String(user?.email ?? '').trim();
  if (isMemberAuthEmail(email)) {
    return email.split('@')[0].toUpperCase();
  }

  return '';
};

const getActiveMemberPhotoUrl = async (idMiembros) => {
  const memberId = Number(idMiembros);

  if (!Number.isFinite(memberId) || !memberId || !FIRESTORE) {
    return '';
  }

  const snapshot = await getDoc(doc(FIRESTORE, 'fotos', `miembro_${memberId}_perfil`)).catch(
    () => null
  );

  if (!snapshot?.exists()) {
    return '';
  }

  const photo = snapshot.data() ?? {};

  return photo.estado === 'activo' ? photo.urlFoto || '' : '';
};

const getMemberIdentityKeys = (user = {}) =>
  new Set(
    [
      user?.uid,
      user?.id,
      user?.idMiembros,
      user?.memberId,
      user?.codigoMiembro,
      user?.codigo,
      user?.correo,
      user?.email,
    ]
      .filter((value) => value !== null && value !== undefined && value !== '')
      .map((value) => String(value).trim().toLowerCase().replace(/\s+/g, ''))
  );

// ¿La ficha abierta es la del propio usuario de la sesion?
//
// Se compara SOLO por id de miembro y por codigo, que son unicos. El correo se
// deja fuera a proposito: hay fichas con correos de relleno repetidos, y una
// coincidencia ahi abriria la ficha de otra persona como si fuera la propia.
export const esFichaDelPropioMiembro = (user = {}, member = {}) => {
  if (!user || !member) {
    return false;
  }

  const clave = (valor) =>
    valor === null || valor === undefined || valor === ''
      ? null
      : String(valor).trim().toLowerCase();

  const clavesUsuario = new Set(
    [user?.idMiembros, user?.memberId, user?.codigoMiembro, user?.codigo].map(clave).filter(Boolean)
  );

  if (!clavesUsuario.size) {
    return false;
  }

  return [member?.id, member?.idMiembros, member?.memberId, member?.codigoMiembro]
    .map(clave)
    .filter(Boolean)
    .some((valor) => clavesUsuario.has(valor));
};

/**
 * Un miembro siempre puede abrir SU ficha con todos los datos a la vista.
 *
 * Antes se le enmascaraba su propia informacion —fecha de nacimiento, telefono,
 * correo, direccion— igual que la de un desconocido. Sus cambios no se guardan
 * directamente: pasan por el Coordinador de Destacamento y su Asistente, que son
 * los unicos que editan sin aprobacion.
 */
export const puedeEditarSuPropiaFicha = (user = {}, member = {}) =>
  isMemberSessionUser(user) && esFichaDelPropioMiembro(user, member);

export const buildDefaultMemberPermissions = () => ({
  miembros: {
    ver: true,
    crear: false,
    editar: false,
    eliminar: false,
    subirFoto: false,
  },
  destacamentos: {
    ver: true,
    crear: false,
    editar: false,
    eliminar: false,
  },
  // Los niveles organizacionales son de consulta para cualquier miembro: ve la
  // estructura, no la toca. Faltaban las dos claves, y sin ellas el menu ocultaba
  // Secciones, Regiones y Consejo Nacional.
  secciones: {
    ver: true,
    crear: false,
    editar: false,
    eliminar: false,
  },
  regiones: {
    ver: true,
    crear: false,
    editar: false,
    eliminar: false,
  },
  asistencia: {
    ver: false,
    crear: false,
    editar: false,
  },
  tienda: {
    ver: true,
    comprar: true,
    administrar: false,
    verPedidos: false,
    gestionarProductos: false,
  },
  ordenes: {
    ver: true,
  },
  recibos: {
    ver: true,
  },
  productos: {
    ver: true,
    crear: false,
    editar: false,
    eliminar: false,
  },
  blog: {
    ver: true,
  },
  course: {
    ver: true,
  },
  archivos: {
    ver: true,
  },
  chats: {
    ver: true,
  },
  calendario: {
    ver: true,
  },
  flujoTrabajo: {
    ver: true,
  },
});

const mergeMemberPermissions = (permissions = {}) => ({
  ...buildDefaultMemberPermissions(),
  ...permissions,
  miembros: {
    ...buildDefaultMemberPermissions().miembros,
    ...(permissions?.miembros ?? {}),
  },
  tienda: {
    ...buildDefaultMemberPermissions().tienda,
    ...(permissions?.tienda ?? {}),
  },
  asistencia: {
    ...buildDefaultMemberPermissions().asistencia,
    ...(permissions?.asistencia ?? {}),
  },
  ordenes: {
    ...buildDefaultMemberPermissions().ordenes,
    ...(permissions?.ordenes ?? {}),
  },
  recibos: {
    ...buildDefaultMemberPermissions().recibos,
    ...(permissions?.recibos ?? {}),
  },
  productos: {
    ...buildDefaultMemberPermissions().productos,
    ...(permissions?.productos ?? {}),
  },
  blog: {
    ...buildDefaultMemberPermissions().blog,
    ...(permissions?.blog ?? {}),
  },
  course: {
    ...buildDefaultMemberPermissions().course,
    ...(permissions?.course ?? {}),
  },
  archivos: {
    ...buildDefaultMemberPermissions().archivos,
    ...(permissions?.archivos ?? {}),
  },
  chats: {
    ...buildDefaultMemberPermissions().chats,
    ...(permissions?.chats ?? {}),
  },
  calendario: {
    ...buildDefaultMemberPermissions().calendario,
    ...(permissions?.calendario ?? {}),
  },
  flujoTrabajo: {
    ...buildDefaultMemberPermissions().flujoTrabajo,
    ...(permissions?.flujoTrabajo ?? {}),
  },
});

const normalizeScopeList = (...values) =>
  values
    .flat()
    .filter((value) => value !== null && value !== undefined && value !== '')
    .map((value) => (Number.isFinite(Number(value)) ? Number(value) : String(value)));

const normalizeScopeId = (value) => String(value ?? '').trim();

const getScopeUserRoleId = (user = {}) => {
  // Se incluye `user.rol`/`user.role` (cuando traen un codigo de rol valido) igual
  // que en getUserRoleId/getOrgRoleId: algunas sesiones exponen el rol ahi y no en
  // rolId, y sin esto el asistente no se reconoceria y quedaria como generico.
  const rawRole = String(user?.rol || user?.role || '').trim().toLowerCase();
  const roleId = String(
    user?.rolId ||
      user?.roleId ||
      user?.rolCodigo ||
      user?.roleCodigo ||
      user?.memberRole ||
      (ROLES_POR_CODIGO[rawRole] ? rawRole : '')
  )
    .trim()
    .toLowerCase();

  // El Coordinador Asistente de Destacamento comparte alcance, permisos y flujo al
  // 100% con el Coordinador de Destacamento (titular): edita miembros de forma
  // DIRECTA (nunca por aprobacion). Se normaliza aqui para que todas las reglas de
  // acceso —incluida isDestacamentoApprovalRole/isCoordinadorDestacamentoRole— lo
  // traten exactamente igual que al titular. (El Pastor NO se normaliza: es un
  // cargo de SOLO LECTURA, no un coordinador.)
  if (roleId === ROLES.USUARIO_DESTACAMENTO_ASISTENTE) {
    return ROLES.USUARIO_DESTACAMENTO;
  }

  return roleId;
};

// Los codigos de TODOS los cargos que la persona ejerce, con la misma
// normalizacion del asistente al titular.
//
// El rol principal es solo el de MAYOR nivel. Quien es Lider de Grupo en su
// destacamento y ademas ocupa una casilla en su seccion entra como seccional, y
// preguntar unicamente por el principal le borraba —sin avisar— todo lo que hace
// en el suyo. La pregunta correcta no es "¿que rol tiene?" sino "¿ejerce alguno
// que...?".
const codigosDeSusCargos = (user = {}) =>
  (Array.isArray(user?.cargos) ? user.cargos : [])
    .map((cargo) =>
      String(cargo?.rol ?? cargo?.rolId ?? cargo?.codigo ?? '')
        .trim()
        .toLowerCase()
    )
    .filter(Boolean)
    .map((codigo) =>
      codigo === ROLES.USUARIO_DESTACAMENTO_ASISTENTE ? ROLES.USUARIO_DESTACAMENTO : codigo
    );

/** El rol principal mas todos sus cargos, sin repetidos. */
const rolesQueEjerce = (user = {}) => [
  ...new Set([getScopeUserRoleId(user), ...codigosDeSusCargos(user)].filter(Boolean)),
];

// Ven la lista de destacamentos de TODA su seccion, no solo el suyo. El Usuario
// Comun va con ellos: es lo que su propia ficha de rol viene prometiendo desde
// el principio —"datos publicos de destacamentos de su seccion"—. Solo abre la
// LISTA: no lleva permisos de edicion, y los miembros de esos destacamentos
// siguen acotados por filterMembersByMemberScope.
const isSectionWideRole = (user = {}) =>
  [ROLES.USUARIO_DESTACAMENTO, ROLES.USUARIO_SECCION].includes(getScopeUserRoleId(user)) ||
  isUsuarioComunRole(user);

// Ya ningún cargo ve la lista COMPLETA por ser "de nivel": los regionales ven su
// región (isRegionScopedMemberViewer) y los seccionales su sección
// (isSectionScopedMemberViewer). Los cargos nacional/global ven todo por la vía
// del fallthrough (sin modo de alcance acotado), no por esta función.
const isOrgWideViewerRole = () => false;

// Cargos regionales que consultan miembros SOLO dentro de su región: Coordinador
// Regional, Sub-Director Regional, los 4 coordinadores de área regional, el
// Capellán Regional y el Secretario Regional.
const REGION_SCOPED_MEMBER_VIEW_ROLE_IDS = [
  ROLES.USUARIO_REGION,
  ROLES.USUARIO_REGION_ASISTENTE,
  ROLES.COORDINADOR_ADIESTRAMIENTO_REGION,
  ROLES.COORDINADOR_PROMOCION_REGION,
  ROLES.COORDINADOR_PRODUCCION_REGION,
  ROLES.COORDINADOR_PROGRAMA_REGION,
  ROLES.CAPELLAN_REGIONAL,
  ROLES.SECRETARIO_REGIONAL,
];

export const isRegionScopedMemberViewer = (user = {}) =>
  REGION_SCOPED_MEMBER_VIEW_ROLE_IDS.includes(getScopeUserRoleId(user));

// Cargos seccionales que consultan miembros y destacamentos SOLO dentro de su
// sección: Coordinador Seccional, Sub-Coordinador y los 4 coordinadores de área
// seccional. (Siguen editando su sección; esto solo acota su VISIBILIDAD.)
const SECTION_SCOPED_MEMBER_VIEW_ROLE_IDS = [
  ROLES.USUARIO_SECCION,
  ROLES.USUARIO_SECCION_ASISTENTE,
  ROLES.COORDINADOR_ADIESTRAMIENTO_SECCION,
  ROLES.COORDINADOR_PROMOCION_SECCION,
  ROLES.COORDINADOR_PRODUCCION_SECCION,
  ROLES.COORDINADOR_PROGRAMA_SECCION,
  // Cargos de consulta de nivel sección. (El Secretario Regional NO va aquí: es
  // un cargo de nivel región, ver REGION_SCOPED_MEMBER_VIEW_ROLE_IDS.)
  ROLES.CAPELLAN_SECCIONAL,
  ROLES.ZONAS,
  ROLES.GRUPOS_LOCALES,
];

export const isSectionScopedMemberViewer = (user = {}) =>
  SECTION_SCOPED_MEMBER_VIEW_ROLE_IDS.includes(getScopeUserRoleId(user));

// Para el listado de miembros, el administrador de destacamento solo ve a los
// miembros de su propio destacamento; el alcance seccional queda reservado al
// administrador de seccion.
const isSectionWideMemberRole = (user = {}) =>
  getScopeUserRoleId(user) === ROLES.USUARIO_SECCION;

const getScopeSectionIds = (scope = {}) =>
  normalizeScopeList(scope?.secciones, scope?.seccionId, scope?.idSeccion).map(normalizeScopeId);

const getScopeDestIds = (scope = {}) =>
  normalizeScopeList(scope?.destacamentos, scope?.destacamentoId, scope?.idDestacamento).map(
    normalizeScopeId
  );

const getDestIdCandidates = (dest = {}) =>
  [dest?.id, dest?.idDestacamento, dest?.destId, dest?.destamentoId]
    .filter((value) => value !== null && value !== undefined && value !== '')
    .map(normalizeScopeId);

const getChurchIdCandidates = (entity = {}) =>
  [entity?.idIglesia, entity?.churchId, entity?.id, entity?.church?.id]
    .filter((value) => value !== null && value !== undefined && value !== '')
    .map(normalizeScopeId);

const getChurchSectionId = (church = {}) =>
  normalizeScopeId(church?.idSeccion ?? church?.sectionId ?? church?.seccionId ?? church?.sectionalId);

const getDestSectionId = (dest = {}, churches = []) => {
  const directSectionId = normalizeScopeId(
    dest?.sectionalId ?? dest?.idSeccion ?? dest?.seccionId ?? dest?.sectionId
  );

  if (directSectionId) return directSectionId;

  const destChurchIds = getChurchIdCandidates(dest);
  const church = churches.find((item) =>
    getChurchIdCandidates(item).some((churchId) => destChurchIds.includes(churchId))
  );

  return getChurchSectionId(church);
};

const resolveSectionIdsForUser = (user = {}, { dests = [], churches = [] } = {}) => {
  const scope = getMemberScope(user);
  const scopeMode = getScopeMode(scope, user);
  const roleId = getScopeUserRoleId(user);
  const sectionIds = new Set(getScopeSectionIds(scope));

  if (sectionIds.size) {
    return sectionIds;
  }

  if (![ALCANCES.DESTACAMENTO, ALCANCES.SECCION].includes(scopeMode) && !isSectionWideRole(user)) {
    return null;
  }

  if (roleId !== ROLES.USUARIO_DESTACAMENTO && scopeMode !== ALCANCES.DESTACAMENTO) {
    // Cargos seccionales sin seccion explicita en el alcance: se deriva de su
    // perfil (seccion directa o su propio destacamento -> iglesia -> seccion),
    // igual que hace `getMemberAllowedDestIds` para acotar la LISTA. Sin esto la
    // seccion propia quedaba vacia y todo destacamento se trataba como ajeno, lo
    // que bloqueaba el contador de miembros incluso en la seccion del usuario.
    if (!sectionIds.size && isSectionScopedMemberViewer(user)) {
      deriveOwnSectionIds(user, { dests, churches }).forEach((sectionId) =>
        sectionIds.add(sectionId)
      );
    }

    return sectionIds;
  }

  const allowedDestIds = new Set(getScopeDestIds(scope));

  if (!allowedDestIds.size || !dests.length || !churches.length) {
    return sectionIds;
  }

  dests.forEach((dest) => {
    const isAllowedDest = getDestIdCandidates(dest).some((destId) => allowedDestIds.has(destId));

    if (!isAllowedDest) return;

    const sectionId = getDestSectionId(dest, churches);

    if (sectionId) {
      sectionIds.add(sectionId);
    }
  });

  return sectionIds;
};

const getDestIdsInSections = (dests = [], churches = [], sectionIds = new Set()) => {
  if (!sectionIds?.size || !dests.length) {
    return new Set();
  }

  const destIds = new Set();

  dests.forEach((dest) => {
    const sectionId = getDestSectionId(dest, churches);

    if (!sectionIds.has(sectionId)) return;

    getDestIdCandidates(dest).forEach((destId) => destIds.add(destId));
  });

  return destIds;
};

const hasDestScopeValues = (scope = {}) =>
  normalizeScopeList(scope?.destacamentos, scope?.destacamentoId, scope?.idDestacamento).length > 0;

const getScopeMode = (scope = {}, user = null) => {
  const explicitMode = scope?.modo || scope?.tipo;

  if (explicitMode) return explicitMode;
  if (hasDestScopeValues(scope)) return 'destacamento';
  if (isMemberSessionUser(user)) return 'destacamento';

  return '';
};

const mergeMemberScope = (scope = {}, member = {}) => {
  const tipo = scope?.tipo ?? scope?.modo ?? 'destacamento';
  const destacamentos = normalizeScopeList(
    scope?.destacamentos,
    scope?.destacamentoId,
    scope?.idDestacamento,
    member?.idDestacamento
  );
  const secciones = normalizeScopeList(scope?.secciones, scope?.seccionId, scope?.idSeccion);
  const regiones = normalizeScopeList(scope?.regiones, scope?.regionId, scope?.idRegion);

  return {
    ...scope,
    tipo,
    modo: tipo,
    destacamentoId: scope?.destacamentoId ?? scope?.idDestacamento ?? destacamentos[0] ?? '',
    idDestacamento: scope?.idDestacamento ?? scope?.destacamentoId ?? destacamentos[0] ?? '',
    seccionId: scope?.seccionId ?? scope?.idSeccion ?? secciones[0] ?? '',
    idSeccion: scope?.idSeccion ?? scope?.seccionId ?? secciones[0] ?? '',
    regionId: scope?.regionId ?? scope?.idRegion ?? regiones[0] ?? '',
    idRegion: scope?.idRegion ?? scope?.regionId ?? regiones[0] ?? '',
    destacamentos,
    secciones,
    regiones,
  };
};

const normalizeMemberProfile = (profile = {}, member = {}, authUser = {}) => ({
  ...profile,
  idMiembros: Number(profile?.idMiembros ?? member?.id ?? 0) || null,
  uid: profile?.uid ?? authUser?.uid ?? '',
  correo: profile?.correo ?? member?.email ?? authUser?.email ?? '',
  nombre: profile?.nombre ?? member?.name ?? '',
  rol: profile?.rol ?? 'miembro',
  estado: profile?.estado ?? 'activo',
  alcance: mergeMemberScope(profile?.alcance, member),
  permisos: mergeMemberPermissions(profile?.permisos),
});

/**
 * Pone en el perfil el rol que le corresponde por su CARGO en la directiva.
 *
 * El rol deja de ser un campo suelto que se elegia en un desplegable: sale de la
 * casilla que la persona ocupa en el organigrama, y quien no ocupa ninguna queda
 * como Usuario Comun. Los administradores —global, funcional y de tienda— se
 * nombran a mano y no se tocan: no hay ninguna casilla de la que deducirlos.
 */
const aplicarRolPorCargo = async (profile = {}) => {
  const rolGuardado = String(profile?.rolId || profile?.rol || '')
    .trim()
    .toLowerCase();

  if (ROLES_ASIGNADOS_A_MANO.includes(rolGuardado)) {
    return profile;
  }

  const idMiembro = profile?.idMiembros;
  const asignaciones = idMiembro
    ? await obtenerAsignacionesDirectivaPorMiembro({ idMiembro }).catch((error) => {
        // Si no se pueden leer los cargos no se inventa un rol: queda el comun,
        // que es el de menos permisos.
        console.warn('[member-access] no se pudieron leer los cargos del miembro', error);
        return [];
      })
    : [];

  const cargos = resolverRolesPorAsignaciones(asignaciones);
  const [principal] = cargos;
  const rol = principal?.rol ?? ROLES.USUARIO_COMUN;

  // Los poderes se SUMAN: quien es Coordinador Asistente en su destacamento y
  // Sub Coordinador en su seccion puede lo de los dos cargos. `can()` ya une
  // `permisosRol` con los permisos directos, asi que basta con dejarlos aqui.
  const permisosDeSusCargos = [
    ...new Set(cargos.flatMap((cargo) => PERMISOS_POR_ROL[cargo.rol] ?? [])),
  ];

  // Y el alcance tambien: cada cargo manda sobre SU entidad.
  const alcanceDeSusCargos = cargos.reduce(
    (acumulado, cargo) => {
      const destino = {
        [DIRECTIVA_LEVELS.destacamento]: 'destacamentos',
        [DIRECTIVA_LEVELS.seccional]: 'secciones',
        [DIRECTIVA_LEVELS.regional]: 'regiones',
      }[cargo.nivel];

      if (destino && cargo.idEntidad) acumulado[destino].push(cargo.idEntidad);

      return acumulado;
    },
    { destacamentos: [], secciones: [], regiones: [] }
  );

  // Solo lectura si TODOS sus cargos lo son: con uno que no lo sea, puede editar
  // lo que ese cargo le permita.
  const soloLectura =
    cargos.length > 0 && cargos.every((cargo) => RESTRICCIONES_ROL[cargo.rol]?.soloLectura === true);

  return {
    ...profile,
    rolId: rol,
    rolNombre: ROLES_POR_CODIGO[rol]?.nombre ?? '',
    cargos,
    permisosRol: [...new Set([...(profile?.permisosRol ?? []), ...permisosDeSusCargos])],
    restricciones: { ...(profile?.restricciones ?? {}), soloLectura },
    alcance: {
      ...(profile?.alcance ?? {}),
      destacamentos: [
        ...new Set([
          ...(profile?.alcance?.destacamentos ?? []),
          ...alcanceDeSusCargos.destacamentos,
        ]),
      ],
      secciones: [
        ...new Set([...(profile?.alcance?.secciones ?? []), ...alcanceDeSusCargos.secciones]),
      ],
      regiones: [
        ...new Set([...(profile?.alcance?.regiones ?? []), ...alcanceDeSusCargos.regiones]),
      ],
    },
  };
};

const syncRoleProfileByAuthUid = async ({
  authUser = {},
  sourceProfile = {},
  profile = {},
  member = {},
}) => {
  if (!authUser?.uid || !FIRESTORE || !profile) {
    return;
  }

  const authUid = String(authUser.uid);

  // Lo que tenga que ver con la CLAVE no se copia: lo lleva el servidor, que es
  // quien puede leer las huellas y hablar con Firebase. `sourceProfile` es una
  // foto tomada al empezar a resolver la sesion, asi que copiarlo de vuelta
  // revivia marcas ya retiradas —a quien acababa de cambiar su clave por correo
  // le volvia a salir "Crea tu contraseña"—. Con `merge` lo omitido se queda
  // como esta en el documento.
  const CAMPOS_DE_CLAVE = [
    'debeCambiarClave',
    'claveTemporal',
    'claveTemporalEn',
    'claveTemporalPor',
    'claveCambiadaEn',
    'clavesAnteriores',
    // El codigo de un solo uso vive con las claves: copiarlo de vuelta reviviria
    // uno ya gastado.
    'codigoRestablecimiento',
  ];
  const perfilSinClaves = Object.fromEntries(
    Object.entries(sourceProfile ?? {}).filter(([campo]) => !CAMPOS_DE_CLAVE.includes(campo))
  );

  await setDoc(
    doc(FIRESTORE, 'usuarios_roles', authUid),
    {
      ...perfilSinClaves,
      uid: authUid,
      correo: sourceProfile?.correo ?? profile?.correo ?? member?.email ?? authUser?.email ?? '',
      nombre:
        sourceProfile?.nombre ?? profile?.nombre ?? member?.name ?? authUser?.displayName ?? '',
      idMiembros: Number(profile?.idMiembros ?? member?.id ?? 0) || null,
      codigoMiembro: sourceProfile?.codigoMiembro ?? member?.memberId ?? member?.codigoMiembro ?? '',
      rol: sourceProfile?.rol ?? profile?.rol ?? 'miembro',
      role: sourceProfile?.role ?? profile?.role ?? sourceProfile?.rol ?? profile?.rol ?? 'miembro',
      estado: sourceProfile?.estado ?? profile?.estado ?? 'activo',
      alcance: profile?.alcance ?? sourceProfile?.alcance ?? {},
      actualizadoEn: new Date().toISOString(),
    },
    { merge: true }
  ).catch((error) => {
    console.warn('[member-access] no se pudo sincronizar usuarios_roles por uid', error);
  });
};

/**
 * ¿Gestiona miembros?
 *
 * Toda la directiva entra con sesion de miembro: el Coordinador de un
 * destacamento es un miembro con un cargo, no una cuenta de administrador.
 * Negarselo por la FORMA de la sesion dejaba la gestion en manos exclusivas de
 * las cuentas de admin, y bastaba con eso para que un Coordinador Asistente no
 * pudiera editar a los suyos.
 *
 * Sobre QUIEN puede hacerlo no decide esta funcion: la acompaña siempre
 * `esMiembroDeSuAlcance`. Y los cargos de supervision quedan fuera igual que en
 * `canEditMembers` —solo consultan—, salvo que ademas tengan cargo en su
 * destacamento, que es cuando vuelven a ser de la casa.
 */
export const canMemberManageMembers = (user) => {
  const permissions = getMemberPermissions(user);
  const members = permissions.miembros ?? {};

  if (members.crear || members.editar || members.eliminar || members.subirFoto) {
    return true;
  }

  if (isSupervisoryMemberViewer(user)) {
    return false;
  }

  const managementPermissions = [
    PERMISOS.MIEMBROS_CREAR,
    PERMISOS.MIEMBROS_EDITAR,
    PERMISOS.MIEMBROS_ELIMINAR,
    PERMISOS.MIEMBROS_SUBIR_FOTO,
  ];

  return managementPermissions.some(
    (permiso) => suCargoDeDestacamentoConcede(user, permiso) || puedeModificar(user, permiso)
  );
};

// --- Alcance regional para la lista de miembros ---

const getScopeRegionIds = (scope = {}) =>
  normalizeScopeList(scope?.regiones, scope?.regionId, scope?.idRegion).map(normalizeScopeId);

const getSectionalOwnScopeId = (sectional = {}) =>
  normalizeScopeId(
    sectional?.idSeccion ?? sectional?.id ?? sectional?.sectionalId ?? sectional?.seccionId
  );

const getSectionalRegionScopeId = (sectional = {}) =>
  normalizeScopeId(sectional?.regionalId ?? sectional?.idRegion ?? sectional?.regionId);

// Deriva la(s) región(es) del propio usuario cuando su alcance no trae una región
// explícita: primero una región/sección directa en su perfil, luego su sección o
// su destacamento propios mapeados a región. Así un Coordinador Regional ve su
// región de origen aunque el rol se le haya asignado sin fijar la región.
const deriveOwnRegionIds = (user = {}, { dests = [], churches = [], sectionals = [] } = {}) => {
  const direct = getScopeRegionIds({
    regiones: user?.regiones,
    regionId: user?.regionId ?? user?.idRegion,
    idRegion: user?.idRegion,
  });
  if (direct.length) return direct;

  const regionIds = new Set();

  const addRegionFromSection = (sectionId) => {
    const normalized = normalizeScopeId(sectionId);
    if (!normalized) return;
    const sectional = sectionals.find((s) => getSectionalOwnScopeId(s) === normalized);
    const regionId = sectional ? getSectionalRegionScopeId(sectional) : '';
    if (regionId) regionIds.add(regionId);
  };

  addRegionFromSection(
    user?.seccionId ?? user?.idSeccion ?? user?.sectionalId ?? user?.sectionId
  );

  if (!regionIds.size) {
    const ownDestId = normalizeScopeId(
      user?.idDestacamento ?? user?.destId ?? user?.destamentoId
    );
    if (ownDestId) {
      const dest = dests.find((d) => getDestIdCandidates(d).includes(ownDestId));
      if (dest) addRegionFromSection(getDestSectionId(dest, churches));
    }
  }

  return Array.from(regionIds);
};

// Deriva la(s) sección(es) del propio usuario cuando su alcance no trae una
// sección explícita: primero una sección directa en su perfil, luego su
// destacamento propio mapeado a sección. Así un Coordinador Seccional ve su
// sección de origen aunque el rol se le haya asignado sin fijarla.
const deriveOwnSectionIds = (user = {}, { dests = [], churches = [] } = {}) => {
  const direct = getScopeSectionIds({
    secciones: user?.secciones,
    seccionId: user?.seccionId ?? user?.idSeccion,
    idSeccion: user?.idSeccion,
  });
  if (direct.length) return direct;

  const ownDestId = normalizeScopeId(user?.idDestacamento ?? user?.destId ?? user?.destamentoId);
  if (ownDestId) {
    const dest = dests.find((d) => getDestIdCandidates(d).includes(ownDestId));
    const sectionId = dest ? normalizeScopeId(getDestSectionId(dest, churches)) : '';
    if (sectionId) return [sectionId];
  }

  return [];
};

// Ids de las secciones que pertenecen a alguna de las regiones del alcance.
const getSectionIdsInRegions = (sectionals = [], regionIds = new Set()) => {
  const sectionIds = new Set();

  if (!regionIds.size || !sectionals.length) {
    return sectionIds;
  }

  sectionals.forEach((sectional) => {
    if (regionIds.has(getSectionalRegionScopeId(sectional))) {
      const sectionId = getSectionalOwnScopeId(sectional);
      if (sectionId) sectionIds.add(sectionId);
    }
  });

  return sectionIds;
};

export const filterMembersByMemberScope = (members = [], user, context = {}) => {
  // Cada quien con los suyos: fuera del Administrador Global y la Oficina
  // Nacional, nadie ve miembros de otro destacamento —tampoco los cargos
  // seccionales o regionales—. Lo de fuera se consulta por otras pantallas.
  if (!puedeVerMiembrosDeTodaLaOrganizacion(user)) {
    return filtrarMiembrosDeSuDestacamento(members, user);
  }

  // Cargos regionales: consulta acotada a los miembros de SU región. Un miembro
  // entra si su región coincide, o su sección/destacamento pertenece a la región.
  if (isRegionScopedMemberViewer(user)) {
    const { dests = [], churches = [], sectionals = [] } = context;

    // Región del alcance explícito; si no hay, se deriva de la propia membresía.
    let regionIds = new Set(getScopeRegionIds(getMemberScope(user)));
    if (!regionIds.size) {
      regionIds = new Set(deriveOwnRegionIds(user, { dests, churches, sectionals }));
    }

    if (!regionIds.size) {
      return [];
    }

    const sectionIds = getSectionIdsInRegions(sectionals, regionIds);
    const allowedDestIds = getDestIdsInSections(dests, churches, sectionIds);

    return members.filter((member) => {
      const memberRegionId = normalizeScopeId(
        member?.regionalId ?? member?.idRegion ?? member?.regionId
      );
      if (memberRegionId && regionIds.has(memberRegionId)) return true;

      const memberSectionId = normalizeScopeId(
        member?.sectionalId ?? member?.idSeccion ?? member?.seccionId ?? member?.sectionId
      );
      if (memberSectionId && sectionIds.has(memberSectionId)) return true;

      const memberDestId = normalizeScopeId(
        member?.idDestacamento ?? member?.destId ?? member?.destamentoId
      );
      return Boolean(memberDestId) && allowedDestIds.has(memberDestId);
    });
  }

  // Cargos seccionales: consulta acotada a los miembros de su REGION (por sección
  // directa del miembro, o por su destacamento dentro de esas secciones). Va en
  // par con `getMemberAllowedDestIds`: si vieran los destacamentos de la región
  // pero solo los miembros de su sección, el contador de Miembros los llevaría a
  // una lista vacía.
  if (isSectionScopedMemberViewer(user)) {
    const { dests = [], churches = [], sectionals = [] } = context;

    const regionIds = getOwnRegionIdsForUser(user, { dests, churches, sectionals });
    let sectionIds =
      regionIds.size && sectionals.length
        ? getSectionIdsInRegions(sectionals, regionIds)
        : new Set();

    // Sin datos para resolver la región: sección del alcance explícito y, si
    // tampoco hay, la derivada de la propia membresía.
    if (!sectionIds.size) {
      sectionIds = new Set(getScopeSectionIds(getMemberScope(user)));
    }
    if (!sectionIds.size) {
      sectionIds = new Set(deriveOwnSectionIds(user, { dests, churches }));
    }

    if (!sectionIds.size) {
      return [];
    }

    const allowedDestIds = getDestIdsInSections(dests, churches, sectionIds);

    return members.filter((member) => {
      const memberSectionId = normalizeScopeId(
        member?.sectionalId ?? member?.idSeccion ?? member?.seccionId ?? member?.sectionId
      );
      if (memberSectionId && sectionIds.has(memberSectionId)) return true;

      const memberDestId = normalizeScopeId(
        member?.idDestacamento ?? member?.destId ?? member?.destamentoId
      );
      return Boolean(memberDestId) && allowedDestIds.has(memberDestId);
    });
  }

  // Cargos nacionales/globales: ven la lista completa (vía fallthrough).
  if (isOrgWideViewerRole(user)) {
    return members;
  }

  const scope = getMemberScope(user);
  const scopeMode = getScopeMode(scope, user);

  if (!scopeMode) {
    return members;
  }

  const sectionIds = resolveSectionIdsForUser(user, context);

  if (isSectionWideMemberRole(user) && sectionIds?.size) {
    const allowedDestinations = getDestIdsInSections(context.dests, context.churches, sectionIds);

    return members.filter((member) => {
      const memberSectionId = normalizeScopeId(
        member?.sectionalId ?? member?.idSeccion ?? member?.seccionId ?? member?.sectionId
      );
      const memberDestId = normalizeScopeId(
        member?.idDestacamento ?? member?.destId ?? member?.destamentoId
      );

      return sectionIds.has(memberSectionId) || allowedDestinations.has(memberDestId);
    });
  }

  if (scopeMode !== ALCANCES.DESTACAMENTO) {
    return members;
  }

  const allowedDestinations = new Set(
    normalizeScopeList(scope.destacamentos, scope.destacamentoId, scope.idDestacamento).map(
      normalizeScopeId
    )
  );

  if (!allowedDestinations.size) {
    return [];
  }

  return members.filter((member) => {
    const memberDestId = member?.idDestacamento ?? member?.destId ?? member?.destamentoId ?? '';

    return allowedDestinations.has(normalizeScopeId(memberDestId));
  });
};

export const getMemberAllowedDestIds = (user, context = {}) => {
  if (isRegionWideSectionViewer(user)) {
    const { dests = [], churches = [], sectionals = [] } = context;

    if (!dests.length || !sectionals.length) return new Set();

    const regionIds = new Set(deriveOwnRegionIds(user, { dests, churches, sectionals }));
    if (!regionIds.size) return new Set();

    return getDestIdsInSections(dests, churches, getSectionIdsInRegions(sectionals, regionIds));
  }

  // Cargos seccionales: consultan los destacamentos de toda su REGION (no solo los
  // de su seccion). Fuera de su region no ven nada.
  if (isSectionScopedMemberViewer(user)) {
    const { dests = [], churches = [], sectionals = [] } = context;

    // Sin lista de destacamentos en el contexto no podemos acotar; no sobre-restringir.
    if (!dests.length) return null;

    const regionIds = getOwnRegionIdsForUser(user, { dests, churches, sectionals });

    if (regionIds.size && sectionals.length) {
      return getDestIdsInSections(
        dests,
        churches,
        getSectionIdsInRegions(sectionals, regionIds)
      );
    }

    // Sin datos para resolver la region (p. ej. secciones aun sin cargar), se cae
    // al alcance mas estrecho de la seccion propia en vez de abrir la lista entera.
    let sectionIds = new Set(getScopeSectionIds(getMemberScope(user)));
    if (!sectionIds.size) {
      sectionIds = new Set(deriveOwnSectionIds(user, { dests, churches }));
    }

    if (!sectionIds.size) return null;

    return getDestIdsInSections(dests, churches, sectionIds);
  }

  // Cargos nacionales/globales (y regionales, que ven toda la estructura): sin
  // restricción de destacamentos.
  if (isOrgWideViewerRole(user)) {
    return null;
  }

  const scope = getMemberScope(user);
  const scopeMode = getScopeMode(scope, user);

  if (!scopeMode) {
    return null;
  }

  const sectionIds = resolveSectionIdsForUser(user, context);

  if (isSectionWideRole(user) && sectionIds?.size) {
    return getDestIdsInSections(context.dests, context.churches, sectionIds);
  }

  if (scopeMode !== ALCANCES.DESTACAMENTO) {
    return null;
  }

  const allowedDestinations = normalizeScopeList(
    scope?.destacamentos,
    scope?.destacamentoId,
    scope?.idDestacamento
  ).map((id) => String(id));

  if (!allowedDestinations.length) {
    return new Set();
  }

  return new Set(allowedDestinations);
};

export const filterDestsByMemberScope = (dests = [], user, context = {}) => {
  const allowedDestinations = getMemberAllowedDestIds(user, { ...context, dests });

  if (allowedDestinations === null) {
    return dests;
  }

  if (!(allowedDestinations instanceof Set) || !allowedDestinations.size) {
    return [];
  }

  return dests.filter((dest) =>
    getDestIdCandidates(dest).some((candidate) => allowedDestinations.has(candidate))
  );
};

// Cargos que ven todas las secciones de SU region (no del pais), pero solo
// pueden interactuar con su propia seccion; el resto se muestra deshabilitado.
// El Pastor NO va aqui: es de solo lectura y no interactua con nada.
const REGION_WIDE_SECTION_VIEWER_ROLE_IDS = [
  ROLES.LIDER_GRUPO,
  ROLES.LIDER_ASISTENTE_GRUPO,
  ROLES.CONSEJO_DESTACAMENTO,
  ROLES.CAPELLAN_DESTACAMENTO,
];

const getSectionalOwnId = (sectional = {}) =>
  normalizeScopeId(sectional?.idSeccion ?? sectional?.id ?? sectional?.sectionalId);

const getSectionalRegionId = (sectional = {}) =>
  normalizeScopeId(sectional?.regionalId ?? sectional?.idRegion ?? sectional?.regionId);

export const isRegionWideSectionViewer = (user = {}) =>
  REGION_WIDE_SECTION_VIEWER_ROLE_IDS.includes(getScopeUserRoleId(user));

// Lider de Grupo y Lider Asistente de Grupo: editan miembros de su destacamento
// pero con campos estructurales/sensibles bloqueados (destacamento, posicion en
// el destacamento, sexo e Instructor CI).
const GROUP_LEADER_ROLE_IDS = [ROLES.LIDER_GRUPO, ROLES.LIDER_ASISTENTE_GRUPO];

export const isGroupLeaderRole = (user = {}) =>
  rolesQueEjerce(user).some((codigo) => GROUP_LEADER_ROLE_IDS.includes(codigo));

// Cargos del destacamento que NO son coordinadores: editan a sus miembros pero
// sus cambios (General y Dispensa Médica) van a APROBACION del Coordinador de
// Destacamento y su Asistente (mismo flujo/bloqueos que el Lider de Grupo). En
// Documentos de salud pueden subir pero no eliminar.
// Pastor, Consejo y Capellán comparten este flujo: editan y envían a aprobación
// igual que el Líder de Grupo (ya no son de solo lectura).
const DESTACAMENTO_APPROVAL_ROLE_IDS = [
  ROLES.PASTOR_DESTACAMENTO,
  ROLES.CONSEJO_DESTACAMENTO,
  ROLES.CAPELLAN_DESTACAMENTO,
  ROLES.LIDER_GRUPO,
  ROLES.LIDER_ASISTENTE_GRUPO,
];

export const isDestacamentoApprovalRole = (user = {}) =>
  rolesQueEjerce(user).some((codigo) => DESTACAMENTO_APPROVAL_ROLE_IDS.includes(codigo));

// Coordinador de Destacamento (titular y asistente comparten alcance; el
// asistente se normaliza a titular en getScopeUserRoleId). Tienen acceso total.
export const isCoordinadorDestacamentoRole = (user = {}) =>
  rolesQueEjerce(user).includes(ROLES.USUARIO_DESTACAMENTO);

// Detecta específicamente al Pastor por su rol CRUDO (sin la normalización a
// titular de getScopeUserRoleId). Se usa para la única excepción del Pastor: en
// Dispensa Médica, la sección de Documentos se le oculta y solo puede solicitar
// acceso al Coordinador de Destacamento.
export const isPastorDestacamentoRole = (user = {}) =>
  [ROLES.PASTOR_DESTACAMENTO, ROLES.CONSEJO_DESTACAMENTO, ROLES.CAPELLAN_DESTACAMENTO].includes(
    String(
      user?.rolId ||
        user?.roleId ||
        user?.rolCodigo ||
        user?.roleCodigo ||
        user?.memberRole ||
        ''
    )
      .trim()
      .toLowerCase()
  );

// --- Capacidades de Dispensa Médica, Ascenso y Padres --------------------------
// Se resuelven contra el CATALOGO de permisos (`can`), no contra listas de roles,
// para que el panel de "Administrar permisos" mande de verdad. El flujo (guardar
// directo vs enviar a aprobacion) lo sigue decidiendo `isDestacamentoApprovalRole`,
// porque es un asunto de proceso, no de capacidad.
// El Administrador Global (y las sesiones admin legadas sin rolId, que `can` no
// puede resolver) conservan acceso total: sin este resguardo perderian permisos
// al pasar el control al catalogo.
const puedePorCatalogo = (user = {}, permiso) =>
  isLegacyFullDashboardAdmin(user) || can(user, permiso);

// Igual que puedePorCatalogo pero para acciones de EDICIÓN: un rol de solo lectura
// (restricción soloLectura del catálogo, p. ej. el Pastor y los cargos de
// consulta) nunca puede modificar, aunque el token traiga permisos de edición
// heredados de una asignación anterior.
const puedeEditarPorCatalogo = (user = {}, permiso) =>
  !isReadOnlyRole(user) && puedePorCatalogo(user, permiso);

export const canViewHealth = (user = {}) => puedePorCatalogo(user, PERMISOS.SALUD_VER);

// Cargos de SUPERVISION (seccion, region y Consejo Nacional). Consultan la ficha
// del miembro pero NUNCA la modifican, y en Dispensa Medica tienen el expediente
// deshabilitado: piden acceso al Coordinador de Destacamento desde el aviso de la
// ficha. Se derivan de ALCANCE_PREDETERMINADO_ROL (alcances seccion/region/
// nacional) para que un rol nuevo de esos niveles quede cubierto automaticamente;
// los cargos de destacamento y los administradores globales no entran aqui.
const SUPERVISORY_SCOPES = new Set([ALCANCES.SECCION, ALCANCES.REGION, ALCANCES.NACIONAL]);

const SUPERVISORY_ROLE_IDS = new Set(
  Object.entries(ALCANCE_PREDETERMINADO_ROL)
    .filter(([, alcance]) => SUPERVISORY_SCOPES.has(alcance))
    .map(([rolId]) => rolId)
);

// Un cargo de destacamento NO se anula por tener ademas uno de seccion, region o
// Consejo Nacional: la persona lo sigue ejerciendo dentro de SU destacamento —lo
// que le impide tocar los demas es `esMiembroDeSuAlcance`, no esto—. Sin esta
// comprobacion, ascender a alguien a la directiva de su seccion le quitaba en
// silencio lo que hacia en su destacamento.
const tieneCargoDeDestacamento = (user = {}) =>
  codigosDeSusCargos(user).some(
    (codigo) => ALCANCE_PREDETERMINADO_ROL[codigo] === ALCANCES.DESTACAMENTO
  );

export const isSupervisoryMemberViewer = (user = {}) =>
  !tieneCargoDeDestacamento(user) &&
  SUPERVISORY_ROLE_IDS.has(
    String(
      user?.rolId ||
        user?.roleId ||
        user?.rolCodigo ||
        user?.roleCodigo ||
        user?.memberRole ||
        user?.rol ||
        user?.role ||
        ''
    )
      .trim()
      .toLowerCase()
  );

// Los cargos de supervision consultan Salud, pero nunca modifican el expediente
// ni gestionan sus documentos.
export const canEditHealth = (user = {}) =>
  !isSupervisoryMemberViewer(user) && puedeEditarPorCatalogo(user, PERMISOS.SALUD_EDITAR);

export const canUploadHealthDocuments = (user = {}) =>
  !isSupervisoryMemberViewer(user) &&
  puedeEditarPorCatalogo(user, PERMISOS.SALUD_SUBIR_DOCUMENTOS);

export const canDeleteHealthDocuments = (user = {}) =>
  !isSupervisoryMemberViewer(user) &&
  puedeEditarPorCatalogo(user, PERMISOS.SALUD_ELIMINAR_DOCUMENTOS);

// Edicion de la ficha del miembro (pestaña General). Los cargos de supervision
// quedan bloqueados por ROL: el catalogo por si solo no basta, porque
// `normalizarAccesoUsuario` une los permisos del rol con los guardados en el
// documento del usuario.
export const canEditMembers = (user = {}) =>
  !isSupervisoryMemberViewer(user) &&
  (suCargoDeDestacamentoConcede(user, PERMISOS.MIEMBROS_EDITAR) ||
    puedeEditarPorCatalogo(user, PERMISOS.MIEMBROS_EDITAR));

export const canAuthorizeMinorHealthAccess = (user = {}) =>
  puedeEditarPorCatalogo(user, PERMISOS.SALUD_AUTORIZAR_ACCESO_MENORES);

export const canViewAwards = (user = {}) => puedePorCatalogo(user, PERMISOS.ASCENSO_VER);

// Pastor, Consejo y Capellán de Destacamento consultan el Sistema de Ascenso pero
// NUNCA lo editan. Se bloquea por ROL además de quitarles `ascenso.editar` del
// catálogo, porque `normalizarAccesoUsuario` UNE los permisos del rol con los
// `permisos` guardados en el documento del usuario: si su ficha conserva
// `ascenso.editar` de una asignación anterior, el catálogo por sí solo no basta.
// Mismo patrón que `canEditHealth` con el Consejo Nacional.
export const canEditAwards = (user = {}) =>
  !isPastorDestacamentoRole(user) && puedeEditarPorCatalogo(user, PERMISOS.ASCENSO_EDITAR);

// --- Academia Ministerial -----------------------------------------------------
// La Academia Ministerial tiene sus PROPIOS permisos de edicion, distintos del
// Sistema de Ascenso: la editan los cargos de destacamento, de seccion y de
// region indicados abajo. Se resuelve con una lista explicita de roles (y no con
// `puedeEditarPorCatalogo`) a proposito, porque varios de esos cargos son de
// consulta para los DATOS DEL MIEMBRO (`soloLectura`) y aun asi deben registrar
// adiestramientos aqui. `soloLectura` sigue protegiendo el resto de la ficha.
const ACADEMIA_MINISTERIAL_EDITOR_ROLE_IDS = new Set([
  // Nivel destacamento: los siete cargos de la rama.
  ROLES.USUARIO_DESTACAMENTO,
  ROLES.USUARIO_DESTACAMENTO_ASISTENTE,
  ROLES.PASTOR_DESTACAMENTO,
  ROLES.CONSEJO_DESTACAMENTO,
  ROLES.CAPELLAN_DESTACAMENTO,
  ROLES.LIDER_GRUPO,
  ROLES.LIDER_ASISTENTE_GRUPO,
  // Nivel seccion, EXCEPTO Zonas y Grupos Locales (quedan como consulta).
  ROLES.USUARIO_SECCION,
  ROLES.USUARIO_SECCION_ASISTENTE,
  ROLES.COORDINADOR_ADIESTRAMIENTO_SECCION,
  ROLES.COORDINADOR_PROMOCION_SECCION,
  ROLES.COORDINADOR_PRODUCCION_SECCION,
  ROLES.COORDINADOR_PROGRAMA_SECCION,
  ROLES.CAPELLAN_SECCIONAL,
  // Nivel region: todos.
  ROLES.SECRETARIO_REGIONAL,
  ROLES.USUARIO_REGION,
  ROLES.USUARIO_REGION_ASISTENTE,
  ROLES.COORDINADOR_ADIESTRAMIENTO_REGION,
  ROLES.COORDINADOR_PROMOCION_REGION,
  ROLES.COORDINADOR_PRODUCCION_REGION,
  ROLES.COORDINADOR_PROGRAMA_REGION,
  ROLES.CAPELLAN_REGIONAL,
]);

export const canEditAcademiaMinisterial = (user = {}) =>
  isLegacyFullDashboardAdmin(user) ||
  getUserRoleId(user) === ROLES.ADMINISTRADOR_GLOBAL ||
  ACADEMIA_MINISTERIAL_EDITOR_ROLE_IDS.has(getUserRoleId(user));

// Dentro de la rama de destacamento, todos menos el Coordinador y su Asistente
// envian sus cambios de Academia Ministerial a APROBACION de ambos. Los cargos de
// seccion y region registran directo (supervisan, no dependen del destacamento).
export const academiaMinisterialRequiresApproval = (user = {}) =>
  isDestacamentoApprovalRole(user);

export const canViewParents = (user = {}) => puedePorCatalogo(user, PERMISOS.PADRES_VER);

// Roles de administración que ven SIEMPRE la información personal completa del
// miembro, aunque el catálogo no les otorgue `miembros.ver_datos_sensibles`.
const FULL_MEMBER_TEXT_ROLE_IDS = new Set([
  ROLES.ADMINISTRADOR_GLOBAL,
  ROLES.ADMINISTRADOR_FUNCIONAL,
]);

// Puede ver la información personal/sensible del miembro en texto plano
// (dirección, teléfono, correo, etc.). Quien NO lo tenga verá esos datos
// enmascarados en la ficha y podrá solicitar acceso al Coordinador de
// Destacamento. Full: administradores global/funcional y los cargos con
// `miembros.ver_datos_sensibles` (coordinador de destacamento y su asistente,
// pastor, consejo de destacamento, consejo ejecutivo, etc.).
// Cargos del destacamento de SOLO LECTURA (Pastor, Consejo, Capellán) para los
// que el CATÁLOGO manda sobre el permiso heredado del token: si el catálogo del
// rol no otorga `miembros.ver_datos_sensibles`, ven los datos enmascarados aunque
// una asignación de rol anterior haya dejado el permiso pegado en el token. Es el
// mismo blindaje que `isReadOnlyRole` aplica a `soloLectura`, para que el cambio
// de rol surta efecto sin re-sincronizar el token en Firebase.
const SENSITIVE_DATA_CATALOG_AUTHORITATIVE_ROLE_IDS = new Set([
  ROLES.PASTOR_DESTACAMENTO,
  ROLES.CONSEJO_DESTACAMENTO,
  ROLES.CAPELLAN_DESTACAMENTO,
]);

/**
 * ¿Se lo concede su cargo de DESTACAMENTO?
 *
 * Sobre los datos de su propio destacamento, el cargo de destacamento va por
 * encima de todo: quien coordina su destacamento sigue coordinandolo aunque
 * ademas ocupe una casilla en su seccion, su region o el Consejo Nacional, y el
 * rol principal pase a ser aquel. Se pregunta al catalogo del cargo, no a los
 * permisos sumados de la sesion, para que la regla no dependa de que la suma
 * sobreviva a los demas filtros.
 *
 * Lo que impide que esto alcance a OTROS destacamentos no es esta funcion, sino
 * `esMiembroDeSuAlcance`, que la acompaña en todas las pantallas.
 */
export const suCargoDeDestacamentoConcede = (user = {}, permiso) =>
  codigosDeSusCargos(user).some(
    (codigo) =>
      ALCANCE_PREDETERMINADO_ROL[codigo] === ALCANCES.DESTACAMENTO &&
      (PERMISOS_POR_ROL[codigo] ?? []).includes(permiso)
  );

export const canViewMemberSensitiveData = (user = {}) => {
  const roleId = getUserRoleId(user);

  if (FULL_MEMBER_TEXT_ROLE_IDS.has(roleId)) {
    return true;
  }

  // Su cargo de destacamento manda sobre la ficha de los suyos, este donde este
  // el rol principal. Sin esta linea, recibir una casilla en la seccion volvia a
  // enmascarar la ficha de los miembros de su propio destacamento.
  if (suCargoDeDestacamentoConcede(user, PERMISOS.MIEMBROS_VER_DATOS_SENSIBLES)) {
    return true;
  }

  // Para los cargos de solo lectura del destacamento y los de supervisión
  // (sección, región y Consejo Nacional), decide únicamente el catálogo del rol
  // (ignora el permiso heredado del token).
  if (SENSITIVE_DATA_CATALOG_AUTHORITATIVE_ROLE_IDS.has(roleId) || isSupervisoryMemberViewer(user)) {
    return (PERMISOS_POR_ROL[roleId] ?? []).includes(PERMISOS.MIEMBROS_VER_DATOS_SENSIBLES);
  }

  return puedePorCatalogo(user, PERMISOS.MIEMBROS_VER_DATOS_SENSIBLES);
};

// Cargos del desplegable de Coordinador de Destacamento que ven la ficha
// ENMASCARADA pero conservan visible la FECHA DE NACIMIENTO de los miembros de su
// destacamento. Es la unica excepcion al enmascarado: la necesitan para conocer la
// edad y la division del miembro (sobre todo en menores). El resto de los datos
// personales —direccion, telefono y correo— siguen ocultos. (El Coordinador,
// Coordinador Asistente y Pastor no aparecen aqui porque ya ven la ficha completa
// sin enmascarar.)
const BIRTHDATE_VISIBLE_WHEN_MASKED_ROLE_IDS = new Set([
  ROLES.CONSEJO_DESTACAMENTO,
  ROLES.CAPELLAN_DESTACAMENTO,
  ROLES.LIDER_GRUPO,
  ROLES.LIDER_ASISTENTE_GRUPO,
]);

// Por todos sus cargos, no solo por el principal: al Consejo, al Capellan y a los
// Lideres de Grupo la fecha de nacimiento les hace falta para saber la division
// de SU gente, y recibir una casilla en la seccion se la borraba.
export const canViewMemberBirthdateWhenMasked = (user = {}) =>
  rolesQueEjerce(user).some((codigo) => BIRTHDATE_VISIBLE_WHEN_MASKED_ROLE_IDS.has(codigo));

// Coordinador Seccional y Coordinador Regional: sobre los miembros MAYORES DE
// EDAD ven en texto plano la fecha de nacimiento, el telefono y el correo. El
// resto de la informacion personal (direccion) sigue enmascarada, y con los
// menores de edad se les enmascara todo como hasta ahora.
const ADULT_CONTACT_VISIBLE_ROLE_IDS = new Set([ROLES.USUARIO_SECCION, ROLES.USUARIO_REGION]);

export const canViewAdultMemberContactData = (user = {}) =>
  ADULT_CONTACT_VISIBLE_ROLE_IDS.has(getUserRoleId(user));

// ¿Al usuario se le deben mostrar en texto plano la fecha de nacimiento, el
// telefono y el correo de ESTE miembro por ser mayor de edad?
export const canViewMemberContactDataByAge = (user = {}, member = {}) => {
  if (!canViewAdultMemberContactData(user)) return false;

  const age = getMemberAge(member);

  return age !== null && age >= EDAD_MAYORIA;
};

// "Visor completo" de la ficha del miembro: puede editar miembros o ver sus
// datos sensibles. Estos cargos ven habilitados todos los tabs de la ficha.
export const isFullMemberViewer = (user = {}) =>
  isLegacyFullDashboardAdmin(user) ||
  can(user, PERMISOS.MIEMBROS_EDITAR) ||
  can(user, PERMISOS.MIEMBROS_VER_DATOS_SENSIBLES);

// Gating de los tabs de la ficha del miembro. El tab General se decide en la
// vista (disponible para quien puede ver miembros). Aquí se resuelven los
// módulos con permiso puntual: un visor completo los ve todos; el resto solo los
// que su permiso autorice.
export const canViewMemberHealthTab = (user = {}) =>
  isFullMemberViewer(user) || canViewHealth(user);

export const canViewMemberAwardsTab = (user = {}) =>
  isFullMemberViewer(user) || canViewAwards(user);

export const canViewMemberParentsTab = (user = {}) =>
  isFullMemberViewer(user) || canViewParents(user);

// El Historial expone cambios de datos generales, salud y ascenso: por eso su
// acceso es mas estrecho que el del resto de tabs. Solo lo ven, y unicamente
// para miembros de SU PROPIO destacamento: el Coordinador de Destacamento (y su
// Asistente, normalizado al titular en getScopeUserRoleId) y el Lider de Grupo.
// El resto de cargos (incluido Lider Asistente de Grupo, Pastor, Consejo,
// Capellan y los niveles de seccion/region) NO ven el contenido: se les muestra
// el aviso de "informacion oculta" con boton de "Solicitar acceso" (mismo patron
// que MemberSensitiveInfoBanner usa para Dispensa Medica).
const HISTORY_TAB_ROLE_IDS = new Set([ROLES.USUARIO_DESTACAMENTO, ROLES.LIDER_GRUPO]);

export const canViewMemberHistoryTab = (user = {}, member = {}) => {
  if (isLegacyFullDashboardAdmin(user)) return true;

  if (!HISTORY_TAB_ROLE_IDS.has(getScopeUserRoleId(user))) return false;

  const memberDestId = normalizeScopeId(
    member?.destId ?? member?.idDestacamento ?? member?.destamentoId
  );

  return Boolean(memberDestId) && getOwnDestIdsForUser(user).has(memberDestId);
};

export const canApproveMemberChanges = (user = {}) =>
  puedeEditarPorCatalogo(user, PERMISOS.MIEMBROS_APROBAR_CAMBIOS);

// Ids de la(s) seccion(es) propias del usuario (a las que esta asignado). Para
// los cargos de destacamento se resuelven a partir de su destacamento.
export const getOwnSectionIdsForUser = (user = {}, { dests = [], churches = [] } = {}) =>
  resolveSectionIdsForUser(user, { dests, churches }) || new Set();

// Ids de la(s) region(es) propias del usuario. Combina el alcance explicito de
// region con la region DERIVADA de su seccion/destacamento (asi un cargo de
// destacamento —p. ej. Coordinador Asistente— identifica su propia region a
// partir de su destacamento -> iglesia -> seccion -> region).
export const getOwnRegionIdsForUser = (
  user = {},
  { dests = [], churches = [], sectionals = [] } = {}
) => {
  const ids = new Set(getScopeRegionIds(getMemberScope(user)));

  // Region derivada de las SECCIONES propias. getOwnSectionIdsForUser resuelve la
  // seccion incluso cuando el destacamento viene en el alcance (no a nivel raiz
  // del usuario), por lo que un Coordinador Asistente identifica su region.
  const ownSectionIds = getOwnSectionIdsForUser(user, { dests, churches });
  sectionals.forEach((sectional) => {
    if (ownSectionIds.has(normalizeScopeId(getSectionalOwnScopeId(sectional)))) {
      const regionId = normalizeScopeId(getSectionalRegionScopeId(sectional));
      if (regionId) ids.add(regionId);
    }
  });

  // Derivacion clasica adicional (por si el alcance trae la region directa).
  deriveOwnRegionIds(user, { dests, churches, sectionals }).forEach((id) =>
    ids.add(normalizeScopeId(id))
  );
  return ids;
};

// Ids del/los destacamento(s) propios del usuario (alcance explicito + el
// destacamento de su propia membresia).
/**
 * Quien ve —y toca— miembros fuera de su propio destacamento.
 *
 * Solo el Administrador Global y la Oficina Nacional. El resto de los cargos,
 * por alto que sea su nivel, trabaja con la gente de SU destacamento: lo demas
 * se consulta por otras pantallas.
 */
export const puedeVerMiembrosDeTodaLaOrganizacion = (user = {}) =>
  isAdminGlobal(user) ||
  isOficinaNacional(user) ||
  ['admin', 'administrador_global'].includes(
    String(user?.role ?? user?.rol ?? '')
      .trim()
      .toLowerCase()
  );

/**
 * ¿Esta persona esta dentro del alcance de quien la mira?
 *
 * Es la condicion que acompaña SIEMPRE al permiso: tener `miembros.editar` o
 * `ascenso.editar` dice que sabe hacerlo; esto dice sobre quien. Sin ella, sumar
 * los cargos de alguien —que es lo correcto— le abria la ficha de cualquier
 * miembro de la organizacion.
 */
export const esMiembroDeSuAlcance = (user = {}, member = null) => {
  if (!member) return true;
  if (isAdminGlobal(user)) return true;

  // Ver toda la organizacion es cosa de la Oficina Nacional, y es CONSULTA: su
  // cargo esta marcado de solo lectura justamente para eso. Si esa misma persona
  // ocupa ademas una casilla en su destacamento —y entonces si puede modificar—,
  // lo que puede tocar sigue siendo lo suyo. Sin esta linea, sumar los dos
  // alcances le entregaria la ficha de cualquier miembro del pais.
  if (puedeVerMiembrosDeTodaLaOrganizacion(user) && !tieneCargoDeDestacamento(user)) {
    return true;
  }

  return filtrarMiembrosDeSuDestacamento([member], user).length > 0;
};

/** Miembros del destacamento (o destacamentos) de quien consulta. */
export const filtrarMiembrosDeSuDestacamento = (miembros = [], user = {}) => {
  const propios = getOwnDestIdsForUser(user);
  const idPropio = String(user?.idMiembros ?? user?.memberId ?? '');

  return (Array.isArray(miembros) ? miembros : []).filter((miembro) => {
    // Su propia ficha siempre, aunque todavia no tenga destacamento.
    if (idPropio && String(miembro?.id ?? miembro?.idMiembros ?? '') === idPropio) return true;

    const suDestacamento = normalizeScopeId(
      miembro?.idDestacamento ?? miembro?.destId ?? miembro?.destamentoId
    );

    return Boolean(suDestacamento) && propios.has(suDestacamento);
  });
};

export const getOwnDestIdsForUser = (user = {}) => {
  const scope = getMemberScope(user);
  // En una combinación, el alcance seccional puede contener muchos
  // destacamentos visibles. Solo la entidad del cargo LOCAL es propia y puede
  // recibir las facultades de edición del Coordinador de Destacamento.
  const destRoleIds = Object.entries(ALCANCE_PREDETERMINADO_ROL)
    .filter(([, alcance]) => alcance === ALCANCES.DESTACAMENTO)
    .map(([roleId]) => roleId);
  const cargoDestIds = getAssignedDestIds(user?.cargos, destRoleIds)
    .map(normalizeScopeId)
    .filter(Boolean);
  const ids = new Set(cargoDestIds.length ? cargoDestIds : getScopeDestIds(scope));
  const ownDestId = normalizeScopeId(
    user?.idDestacamento ??
      user?.destId ??
      user?.destamentoId ??
      (cargoDestIds.length ? '' : (scope?.destacamentoId ?? scope?.idDestacamento))
  );
  if (ownDestId) ids.add(ownDestId);
  return ids;
};

export const filterSectionalsByMemberScope = (
  sectionals = [],
  user,
  { dests = [], churches = [] } = {}
) => {
  const scope = getMemberScope(user);
  const scopeMode = getScopeMode(scope, user);

  // Cargos con visibilidad de toda su region: se listan unicamente las secciones
  // de la region a la que pertenece su propia seccion. Las demas regiones se
  // ocultan por completo; el marcado de "propia vs ajena" (para deshabilitar la
  // interaccion) lo aplica la vista con isRegionWideSectionViewer/own ids.
  if (isRegionWideSectionViewer(user)) {
    const ownSectionIds = getOwnSectionIdsForUser(user, { dests, churches });

    if (!ownSectionIds.size) {
      return [];
    }

    const ownRegionIds = new Set(
      sectionals
        .filter((sectional) => ownSectionIds.has(getSectionalOwnId(sectional)))
        .map(getSectionalRegionId)
        .filter(Boolean)
    );

    if (!ownRegionIds.size) {
      return sectionals.filter((sectional) => ownSectionIds.has(getSectionalOwnId(sectional)));
    }

    return sectionals.filter((sectional) => ownRegionIds.has(getSectionalRegionId(sectional)));
  }

  // El administrador de destacamento puede consultar todas las secciones (solo
  // lectura); los cargos seccionales y regionales TAMBIÉN ven todas las secciones
  // (su acotamiento es solo sobre miembros/destacamentos, no sobre la lista de
  // secciones). El Usuario Comun va con ellos: la estructura de la organizacion
  // no es un dato reservado, y no lleva ningun permiso de edicion con el que
  // pudiera tocar una seccion ajena.
  if (
    [ROLES.USUARIO_DESTACAMENTO, ROLES.USUARIO_COMUN].includes(getScopeUserRoleId(user)) ||
    isUsuarioComunRole(user) ||
    isOrgWideViewerRole(user) ||
    isSectionScopedMemberViewer(user) ||
    isRegionScopedMemberViewer(user)
  ) {
    return sectionals;
  }

  if (!scopeMode || scope?.nacional || scopeMode === ALCANCES.NACIONAL || scopeMode === ALCANCES.GLOBAL) {
    return sectionals;
  }

  const sectionIds = resolveSectionIdsForUser(user, { dests, churches });

  if (!sectionIds?.size) {
    return isSectionWideRole(user) ? [] : sectionals;
  }

  return sectionals.filter((sectional) =>
    sectionIds.has(normalizeScopeId(sectional?.idSeccion ?? sectional?.id ?? sectional?.sectionalId))
  );
};

export const filterOrdersByMemberSession = (orders = [], user) => {
  if (!isMemberSessionUser(user)) {
    return orders;
  }

  const memberKeys = getMemberIdentityKeys(user);

  if (!memberKeys.size) {
    return [];
  }

  return orders.filter((order) => {
    const sources = [order, order?.customer, order?.billing, order?.shippingAddress];

    return sources.some((source) => {
      if (!source || typeof source !== 'object') {
        return false;
      }

      const sourceKeys = [
        source?.uid,
        source?.id,
        source?.memberId,
        source?.idMiembros,
        source?.codigoMiembro,
        source?.correo,
        source?.email,
      ]
        .filter((value) => value !== null && value !== undefined && value !== '')
        .map((value) => String(value).trim().toLowerCase().replace(/\s+/g, ''));

      return sourceKeys.some((key) => memberKeys.has(key));
    });
  });
};

const navPermissionByItem = (item, user) => {
  const permissions = getMemberPermissions(user);
  const title = normalizeText(item.title || '');
  const path = String(item.path || '');

  if (
    path === paths.dashboard.root ||
    path === paths.dashboard.principal ||
    title === 'principal' ||
    title === 'aplicacion' ||
    title === 'aplicación' ||
    title === 'dashboard'
  ) {
    return true;
  }

  if (item?.memberShopChild) {
    return true;
  }

  if (isMemberSessionUser(user) && (title.includes('recibo') || title.includes('invoice'))) {
    return false;
  }

  if (title.includes('miembro')) return Boolean(permissions.miembros?.ver);
  // El area de Administradores —con Historial - Logs dentro— es de gobierno de
  // toda la organizacion. La decide el ROL, no el objeto `permisos`: una sesion
  // de cargo puede traer `administradores.ver` heredado y colarse. El bloqueo
  // real esta ademas en el layout; esto solo evita ensenar la puerta.
  if (title.includes('administrador')) {
    return puedeEntrarAAdministracion(user);
  }
  if (title.includes('destacamento')) return Boolean(permissions.destacamentos?.ver);
  if (title.includes('asistencia') || path.includes('/dashboard/level/attendance')) {
    return canViewAdminModule(permissions, 'asistencia', user);
  }
  // Los niveles organizacionales superiores (sección, región y consejo nacional)
  // no viven en el objeto `permisos` del miembro, así que además del objeto se
  // consulta el catálogo por rol (`can`). Esto permite que cargos de consulta
  // nacional —p. ej. el Director Nacional— vean todos los niveles en el menú.
  // El Usuario Comun entra por su propia via: su documento de sesion guarda un
  // objeto `permisos` que no trae las claves `secciones` ni `regiones`, y su rol
  // ('miembro') no existe en el catalogo, asi que ninguna de las dos
  // comprobaciones de abajo podia darle acceso.
  if (title.includes('seccion')) {
    return (
      Boolean(permissions.secciones?.ver) ||
      can(user, PERMISOS.SECCIONES_VER) ||
      isUsuarioComunRole(user)
    );
  }
  if (title.includes('region') || title.includes('consejo nacional')) {
    return (
      Boolean(permissions.regiones?.ver || permissions.nacional?.ver) ||
      can(user, PERMISOS.REGIONES_VER) ||
      can(user, PERMISOS.REPORTES_VER_NACIONALES) ||
      isUsuarioComunRole(user)
    );
  }
  if (title.includes('compra') || path.includes('checkout'))
    return Boolean(permissions.tienda?.ver);
  if (isMemberSessionUser(user) && (title.includes('orden') || title.includes('invoice'))) {
    return false;
  }
  if (path === paths.dashboard.product.root || path === paths.dashboard.product.demo.details) {
    return Boolean(permissions.productos?.ver);
  }
  if (path === paths.dashboard.product.new) return Boolean(permissions.productos?.crear);
  if (title.includes('editar') && path.includes('/dashboard/product/'))
    return Boolean(permissions.productos?.editar);
  if (title.includes('producto')) return Boolean(permissions.productos?.ver);
  if (title.includes('recibo') || title.includes('invoice'))
    return Boolean(permissions.recibos?.ver);
  if (title.includes('orden')) return Boolean(permissions.ordenes?.ver);
  if (title.includes('blog') || path.includes('/dashboard/post'))
    return Boolean(permissions.blog?.ver);
  if (title.includes('course') || path === paths.dashboard.general.course)
    return Boolean(permissions.course?.ver);
  if (
    title.includes('archivo') ||
    title.includes('document') ||
    path === paths.dashboard.fileManager
  ) {
    return Boolean(permissions.archivos?.ver);
  }
  if (title.includes('chat')) return Boolean(permissions.chats?.ver);
  if (title.includes('calendario') || title.includes('actividades')) {
    return Boolean(permissions.calendario?.ver);
  }
  if (title.includes('flujo') || title.includes('kanban'))
    return Boolean(permissions.flujoTrabajo?.ver);

  return false;
};

const hasExplicitPermissions = (permissions = {}) =>
  Boolean(
    permissions &&
      typeof permissions === 'object' &&
      !Array.isArray(permissions) &&
      Object.keys(permissions).length
  );

const STORE_ADMIN_ROLE_IDS = new Set([ROLES.ADMINISTRADOR_TIENDA]);

const ADMIN_PERMISSION_MODULE_KEYS = new Set([
  'administradores',
  'secciones',
  'regiones',
  'publicaciones',
  'pedidos',
  'facturas',
  'notificaciones',
  'logs',
  'mantenimiento',
]);

const getUserRoleId = (user = {}) => {
  const explicitRoleId = String(
    user?.rolId ?? user?.roleId ?? user?.rolCodigo ?? user?.roleCodigo ?? user?.memberRole ?? ''
  )
    .trim()
    .toLowerCase();

  if (explicitRoleId) {
    return explicitRoleId;
  }

  const roleName = normalizeText(user?.rolNombre ?? user?.roleName ?? user?.cargo ?? '');

  if (roleName.includes('administrador') && roleName.includes('tienda')) {
    return ROLES.ADMINISTRADOR_TIENDA;
  }

  if (roleName.includes('administrador') && roleName.includes('destacamento')) {
    return ROLES.USUARIO_DESTACAMENTO;
  }

  if (roleName.includes('usuario') && roleName.includes('comun')) {
    return ROLES.USUARIO_COMUN;
  }

  return '';
};

/**
 * El Usuario Común solo tiene acceso de lectura al Sistema de Ascenso: no puede
 * agregar ni cambiar nada (los demas cargos del destacamento con acceso si).
 *
 * Se reconoce tambien al miembro SIN cargo, que es un Usuario Comun aunque nada
 * lo diga con esas palabras: su sesion se guarda con `rol: 'miembro'`, que no es
 * un codigo del catalogo, y ni `getUserRoleId` ni `can()` daban con el. Por eso
 * los niveles organizacionales le seguian sin aparecer en el menu por mucho que
 * el catalogo de USUARIO_COMUN los permitiera: a esa entrada no llegaba nadie.
 */
export const isUsuarioComunRole = (user = {}) => {
  const roleId = getUserRoleId(user) || getScopeUserRoleId(user);

  if (roleId === ROLES.USUARIO_COMUN) return true;

  // No basta con mirar si el rol viene vacio: la sesion de un miembro sin cargo
  // guarda `rol` y `memberRole` con el valor 'miembro', que NO es ningun codigo
  // del catalogo pero tampoco es cadena vacia. Se compara contra el catalogo:
  // lo que no esta en el no es un cargo.
  return isMemberSessionUser(user) && !ROLES_POR_CODIGO[roleId];
};

// Posiciones que ven la lista de miembros pero NO pueden acceder a la ficha de
// los menores: estos aparecen en la lista pero DESHABILITADOS. Aplica a los
// cargos de Sección (Coordinador Seccional y afines) y, a nivel nacional, al
// Director Nacional (consulta global sin acceso a menores).
const MINOR_RESTRICTED_ROLE_IDS = [
  ROLES.USUARIO_SECCION,
  ROLES.USUARIO_SECCION_ASISTENTE,
  ROLES.COORDINADOR_ADIESTRAMIENTO_SECCION,
  ROLES.COORDINADOR_PROMOCION_SECCION,
  ROLES.COORDINADOR_PRODUCCION_SECCION,
  ROLES.COORDINADOR_PROGRAMA_SECCION,
  ROLES.DIRECTOR_NACIONAL,
];

// Puede acceder a la ficha/datos de un menor (catálogo: `miembros.ver_menores`).
export const canAccessMinorMembers = (user = {}) =>
  puedePorCatalogo(user, PERMISOS.MIEMBROS_VER_MENORES);

// True si al usuario se le deben mostrar los menores DESHABILITADOS en las listas
// de miembros (ve la fila/tarjeta pero no puede abrirla).
export const shouldDisableMinorMembers = (user = {}) =>
  MINOR_RESTRICTED_ROLE_IDS.includes(getUserRoleId(user)) &&
  !canAccessMinorMembers(user);

// Determina si un miembro es menor de edad a partir de su fecha de nacimiento.
// (Misma lógica que `esMiembroMenorDeEdad` del servicio de salud, replicada aquí
// para no acoplar utils a services.)
export const isMinorMember = (member = {}) => {
  const raw =
    member?.birthDate || member?.birth || member?.dateOfBirth || member?.fechaNacimiento || '';
  if (!raw) return false;

  const birth = new Date(raw);
  if (Number.isNaN(birth.getTime())) return false;

  const now = new Date();
  let edad = now.getFullYear() - birth.getFullYear();
  const mes = now.getMonth() - birth.getMonth();
  if (mes < 0 || (mes === 0 && now.getDate() < birth.getDate())) edad -= 1;

  return edad >= 0 && edad < 18;
};

const getExcludedPermissionCodes = (user = {}) =>
  [user?.permisosExcluidos, user?.excludedPermissions]
    .flat()
    .filter(Boolean)
    .map((permission) => String(permission).trim().toLowerCase());

const getAuthorizationPermissionCodes = (user = {}) =>
  (() => {
    const excludedPermissions = new Set(getExcludedPermissionCodes(user));
    const rolePermissions = PERMISOS_POR_ROL[getUserRoleId(user)] ?? [];

    return [
      rolePermissions,
      user?.permisosRol,
      user?.permisosDirectos,
      user?.permisosAutorizacion,
      Array.isArray(user?.permisos) ? user.permisos : [],
      Array.isArray(user?.permissions) ? user.permissions : [],
    ]
      .flat()
      .filter(Boolean)
      .map((permission) => String(permission).trim().toLowerCase())
      .filter((permission) => !excludedPermissions.has(permission));
  })();

// Solo el administrador de gestión de la tienda puede administrar productos
// (crear/editar/publicar/eliminar). Por auditoría y por tratarse de dinero,
// ningún otro administrador —ni el global— tiene acceso a esa gestión.
export const hasStoreAdminAccess = (user = {}) => STORE_ADMIN_ROLE_IDS.has(getUserRoleId(user));

export const canManageStoreProducts = (user = {}) => hasStoreAdminAccess(user);

const hasExplicitAdminPermissions = (permissions = {}) =>
  hasExplicitPermissions(permissions) &&
  Object.keys(permissions).some((permissionKey) => ADMIN_PERMISSION_MODULE_KEYS.has(permissionKey));

const isLegacyFullDashboardAdmin = (user = {}) => {
  if (!isAdminSessionUser(user)) {
    return false;
  }

  const roleId = getUserRoleId(user);

  if (roleId === ROLES.ADMINISTRADOR_GLOBAL) {
    return true;
  }

  if (roleId === ROLES.ADMINISTRADOR_FUNCIONAL || roleId === ROLES.ADMINISTRADOR_TIENDA) {
    return false;
  }

  return (
    !roleId &&
    !hasExplicitAdminPermissions(getMemberPermissions(user)) &&
    !getAuthorizationPermissionCodes(user).length
  );
};

const shouldUseCustomerShopNav = (user = {}) =>
  isAdminSessionUser(user) && !isLegacyFullDashboardAdmin(user) && !hasStoreAdminAccess(user);

const isCustomerShopParentItem = (item = {}) => {
  const title = normalizeText(item.title || '');
  const path = String(item.path || '');

  return (
    title.includes('tienda') ||
    title.includes('producto') ||
    path === paths.dashboard.product.root ||
    path.includes('/dashboard/product')
  );
};

const isShopNavItem = (item = {}) => {
  const title = normalizeText(item.title || '');
  const path = String(item.path || '');

  return (
    title.includes('tienda') ||
    title.includes('producto') ||
    path === paths.dashboard.product.root ||
    path.includes('/dashboard/product') ||
    path.includes('/dashboard/checkout')
  );
};

const buildCustomerShopNavItem = (item = {}) => ({
  ...item,
  title: 'Tienda Virtual',
  path: paths.dashboard.product.root,
  children: [
    {
      title: 'Lista de productos',
      path: paths.dashboard.product.root,
      deepMatch: true,
      memberShopChild: true,
    },
    {
      title: 'Mis ordenes',
      path: paths.dashboard.order.root,
      deepMatch: true,
      memberShopChild: true,
    },
    {
      title: 'Mis recibos',
      path: paths.dashboard.invoice.root,
      deepMatch: true,
      memberShopChild: true,
    },
  ],
  activePaths: [
    paths.dashboard.product.root,
    paths.dashboard.order.root,
    paths.dashboard.invoice.root,
  ],
  deepMatch: true,
});

// Codigos del catalogo que habilitan cada modulo del menu. Se admite MAS DE UNO
// por modulo: `regiones` agrupa las entradas "Regiones" y "Consejo Nacional", y
// hay cargos que llegan por el permiso de estructura (`regiones.ver`) y otros por
// el de reportes (`reportes.ver_regionales`). Basta con tener cualquiera.
const MODULE_PERMISSION_CODES_BY_KEY = {
  asistencia: ['asistencia.ver'],
  destacamentos: ['destacamentos.ver'],
  miembros: ['miembros.ver'],
  secciones: ['secciones.ver'],
  regiones: ['reportes.ver_regionales', 'regiones.ver'],
  productos: ['tienda.ver'],
};

const hasAnyModulePermissionCode = (user, moduleKey) => {
  const permissionCodes = MODULE_PERMISSION_CODES_BY_KEY[moduleKey];

  if (!permissionCodes) return null;

  const granted = getAuthorizationPermissionCodes(user);

  return permissionCodes.some((permissionCode) => granted.includes(permissionCode));
};

const canViewAdminModule = (permissions = {}, moduleKey, user = {}) => {
  if (!hasExplicitPermissions(permissions)) {
    return hasAnyModulePermissionCode(user, moduleKey) ?? true;
  }

  if (!moduleKey) {
    return true;
  }

  if (permissions[moduleKey]?.ver) {
    return true;
  }

  return hasAnyModulePermissionCode(user, moduleKey) ?? false;
};

const adminModuleByItem = (item) => {
  const title = normalizeText(item.title || '');
  const path = String(item.path || '');

  if (
    path === paths.dashboard.root ||
    path === paths.dashboard.principal ||
    path === paths.dashboard.principal2 ||
    title === 'principal' ||
    title === 'principal 2' ||
    title === 'aplicacion' ||
    title === 'aplicaciÃ³n' ||
    title === 'dashboard'
  ) {
    return null;
  }

  if (path.startsWith(paths.dashboard.admin.logs) || title.includes('log')) return 'logs';
  if (path.startsWith(paths.dashboard.admin.notifications) || title.includes('notificacion')) {
    return 'notificaciones';
  }
  if (
    path.startsWith(paths.dashboard.admin.maintenance) ||
    path.startsWith(paths.dashboard.admin.health) ||
    title.includes('mantenimiento') ||
    title.includes('salud del sistema')
  ) {
    return 'mantenimiento';
  }
  if (
    path.startsWith(paths.dashboard.admin.userPermissions) ||
    title.includes('permiso') ||
    title.includes('administrador')
  ) {
    return 'administradores';
  }

  if (
    path.includes('/dashboard/level/member') ||
    path.includes('/dashboard/member') ||
    title.includes('miembro')
  ) {
    return 'miembros';
  }
  if (path.includes('/dashboard/level/dest') || title.includes('destacamento')) {
    return 'destacamentos';
  }
  if (path.includes('/dashboard/level/attendance') || title.includes('asistencia')) {
    return 'asistencia';
  }
  if (path.includes('/dashboard/level/sectional') || title.includes('seccion')) return 'secciones';
  if (
    path.includes('/dashboard/level/regional') ||
    path.includes('/dashboard/level/national') ||
    title.includes('region') ||
    title.includes('consejo nacional')
  ) {
    return 'regiones';
  }
  if (path.includes('/dashboard/post') || title.includes('blog') || title.includes('publicacion')) {
    return 'publicaciones';
  }
  if (path.includes('/dashboard/order') || title.includes('orden') || title.includes('pedido')) {
    return 'pedidos';
  }
  if (path.includes('/dashboard/invoice') || title.includes('recibo') || title.includes('factura')) {
    return 'facturas';
  }
  if (
    path.includes('/dashboard/product') ||
    path.includes('/dashboard/checkout') ||
    title.includes('producto') ||
    title.includes('tienda') ||
    title.includes('carrito')
  ) {
    return 'productos';
  }
  if (
    path.includes('/dashboard/file') ||
    title.includes('archivo') ||
    title.includes('documento')
  ) {
    return 'archivos';
  }

  return null;
};

const navPermissionByAdminItem = (item, user) => {
  if (item.disabled) return false;

  if (isLegacyFullDashboardAdmin(user)) {
    return true;
  }

  const permissions = getMemberPermissions(user);
  const moduleKey = adminModuleByItem(item);

  return canViewAdminModule(permissions, moduleKey, user);
};

export const filterDashboardNavDataForMember = (navData = [], user) =>
  navData
    .map((section) => {
      const filterItems = (items = []) =>
        items
          .map((item) => {
            const childItems = item.children ? filterItems(item.children) : [];
            const itemAllowed = navPermissionByItem(item, user);
            const title = normalizeText(item.title || '');
            const isShopItem = isShopNavItem(item);
            const isMemberDirectContentItem =
              title.includes('blog') ||
              title.includes('course') ||
              title.includes('document') ||
              title.includes('archivo') ||
              title.includes('chat') ||
              title.includes('calendario') ||
              title.includes('actividades') ||
              title.includes('flujo') ||
              title.includes('kanban');

            if (item.children) {
              if (isMemberSessionUser(user) && isShopItem) {
                return itemAllowed ? buildCustomerShopNavItem(item) : null;
              }

              if (isMemberSessionUser(user) && isMemberDirectContentItem && itemAllowed) {
                return {
                  ...item,
                  children: undefined,
                };
              }

              if (itemAllowed || childItems.length) {
                const memberShopTitle =
                  isMemberSessionUser(user) && isShopItem ? 'Tienda Virtual' : item.title;

                return {
                  ...item,
                  title: memberShopTitle,
                  children: childItems,
                };
              }

              return null;
            }

            return itemAllowed ? item : null;
          })
          .filter(Boolean);

      const items = filterItems(section.items);

      return items.length ? { ...section, items } : null;
    })
    .filter(Boolean);

// Es el Administrador Global (control total). Es el unico rol que ve las
// pestanas de demostracion/desarrollo del template (Aplicacion, Ecommerce,
// Analytics, Banking, File, Course, Usuario - desarrollo, Job, Tour).
const isGlobalAdminUser = (user = {}) =>
  getUserRoleId(user) === ROLES.ADMINISTRADOR_GLOBAL || isLegacyFullDashboardAdmin(user);

// Pestanas de demo/desarrollo del template que solo debe ver el Administrador
// Global. Para el resto de usuarios (miembros y demas administradores) se ocultan
// del sidebar por completo y quedan inaccesibles desde la navegacion.
const isDevDemoNavItem = (item = {}) => {
  const title = normalizeText(item.title || '');
  const path = String(item.path || '');

  const devDemoPaths = [
    paths.dashboard.root,
    paths.dashboard.general.ecommerce,
    paths.dashboard.general.analytics,
    paths.dashboard.general.banking,
    paths.dashboard.general.file,
    paths.dashboard.general.course,
    paths.dashboard.user.root,
    paths.dashboard.job.root,
    paths.dashboard.tour.root,
  ];

  if (devDemoPaths.includes(path)) {
    return true;
  }

  return (
    title === 'aplicacion' ||
    title === 'ecommerce' ||
    title === 'analytics' ||
    title === 'banking' ||
    title === 'file' ||
    title === 'course' ||
    title === 'usuario - desarrollo' ||
    title === 'job' ||
    title === 'tour'
  );
};

const stripDevDemoNavItems = (navData = []) =>
  navData
    .map((section) => {
      const items = (section.items ?? []).filter((item) => !isDevDemoNavItem(item));

      return items.length ? { ...section, items } : null;
    })
    .filter(Boolean);

export const filterDashboardNavDataByUser = (navData = [], user) => {
  const baseNavData = isGlobalAdminUser(user) ? navData : stripDevDemoNavItems(navData);

  if (isMemberSessionUser(user)) {
    return filterDashboardNavDataForMember(baseNavData, user);
  }

  if (!isAdminSessionUser(user)) {
    return baseNavData;
  }

  const filterItems = (items = []) =>
    items
      .map((item) => {
        if (shouldUseCustomerShopNav(user) && isCustomerShopParentItem(item)) {
          return buildCustomerShopNavItem(item);
        }

        const childItems = item.children ? filterItems(item.children) : [];
        const itemAllowed = navPermissionByAdminItem(item, user);

        if (item.children) {
          if (itemAllowed || childItems.length) {
            return {
              ...item,
              children: childItems.length ? childItems : undefined,
            };
          }

          return null;
        }

        return itemAllowed ? item : null;
      })
      .filter(Boolean);

  return baseNavData
    .map((section) => {
      const items = filterItems(section.items);

      return items.length ? { ...section, items } : null;
    })
    .filter(Boolean);
};

export const loadMemberAccessProfile = async (authUser) => {
  if (!isFirebaseConfigured || !FIRESTORE) {
    return null;
  }

  const email = String(authUser?.email ?? '')
    .trim()
    .toLowerCase();
  const isMemberAuth = email.endsWith(`@${MEMBER_AUTH_DOMAIN}`);
  const profileByUid = await loadProfileByUid('usuarios_roles', authUser?.uid);

  if (!isMemberAuth && !profileByUid) {
    return null;
  }

  // Ruta rápida: si el perfil de Firestore ya trae idMiembros, resolvemos la
  // sesión sin descargar TODA la lista de miembros desde la API externa
  // (systexploradores.somee.com), que es el mayor cuello de botella del login.
  // La lista solo hace falta para emparejar a un usuario que aún no tiene perfil.
  if (profileByUid?.idMiembros) {
    const idMiembros = Number(profileByUid.idMiembros);
    const minimalMember = {
      id: idMiembros,
      idDestacamento:
        profileByUid?.alcance?.destacamentos?.[0] ?? profileByUid?.idDestacamento ?? null,
      email: profileByUid?.correo ?? email,
      name: profileByUid?.nombre ?? '',
      memberId: profileByUid?.codigoMiembro ?? '',
    };
    const profile = await aplicarRolPorCargo(
      normalizeMemberProfile(profileByUid, minimalMember, authUser)
    );
    const photoURL = await getActiveMemberPhotoUrl(idMiembros);

    // Sincronización de usuarios_roles fuera de la ruta crítica (no se espera).
    void syncRoleProfileByAuthUid({
      authUser,
      sourceProfile: profileByUid,
      profile,
      member: minimalMember,
    });

    return {
      member: minimalMember,
      profile: {
        ...profile,
        photoURL: photoURL || profile.photoURL,
      },
      accessToken: authUser?.accessToken ?? null,
    };
  }

  const loginValue = email.split('@')[0];
  const normalizedLogin = normalizeMemberUsername(
    isMemberAuth
      ? loginValue
      : profileByUid?.codigoMiembro || profileByUid?.idMiembros || profileByUid?.correo || email
  );
  const members = await getMembers();

  const member = members.find((item) => {
    const itemCandidates = [item.id, item.memberId, item.idMiembros, item.codigoMiembro, item.email]
      .filter(Boolean)
      .map((candidate) => normalizeMemberUsername(candidate));

    return (
      itemCandidates.includes(normalizedLogin) ||
      (profileByUid?.idMiembros && Number(item.id) === Number(profileByUid.idMiembros)) ||
      (profileByUid?.codigoMiembro &&
        itemCandidates.includes(normalizeMemberUsername(profileByUid.codigoMiembro)))
    );
  });

  if (!member) {
    return {
      member: null,
      profile: null,
      accessToken: authUser?.accessToken ?? null,
    };
  }

  const directProfile =
    profileByUid ?? (await loadProfileByUid('usuarios_roles', String(member.id)));

  const profileByMemberId = directProfile
    ? null
    : await (async () => {
        const memberId = Number(member.id);

        if (!Number.isFinite(memberId)) {
          return null;
        }

        const profileQuery = query(
          collection(FIRESTORE, 'usuarios_roles'),
          where('idMiembros', '==', memberId),
          limit(1)
        );
        const querySnap = await getDocs(profileQuery);

        if (querySnap.empty) {
          return null;
        }

        return querySnap.docs[0].data() ?? null;
      })();

  const sourceProfile =
    directProfile ??
    profileByMemberId ?? {
      idMiembros: Number(member.id),
      uid: authUser?.uid ?? '',
      correo: member.email ?? email,
      nombre: member.name ?? '',
      rol: 'miembro',
      estado: 'activo',
      alcance: {
        modo: 'destacamento',
        destacamentos: member.idDestacamento ? [Number(member.idDestacamento)] : [],
        regiones: [],
        secciones: [],
      },
      permisos: {
        ...buildDefaultMemberPermissions(),
      },
    };
  const profile = await aplicarRolPorCargo(
    normalizeMemberProfile(sourceProfile, member, authUser)
  );
  const photoURL = await getActiveMemberPhotoUrl(profile.idMiembros ?? member.id);

  // Sincronización fuera de la ruta crítica (no se espera): no debe retrasar el login.
  void syncRoleProfileByAuthUid({ authUser, sourceProfile, profile, member });

  return {
    member,
    profile: {
      ...profile,
      photoURL: photoURL || profile.photoURL,
    },
    accessToken: authUser?.accessToken ?? null,
  };
};

export const buildMemberSessionUser = (authUser, access = {}) => {
  const { member = null, profile = null } = access;
  const displayName =
    [member?.firstName, member?.lastName].filter(Boolean).join(' ').trim() ||
    member?.name ||
    profile?.nombre ||
    authUser?.displayName ||
    authUser?.email ||
    '';
  const memberCode = getMemberCodeLabel(member) || getMemberCodeLabel(profile);

  return {
    ...authUser,
    ...(member ?? {}),
    ...(profile ?? {}),
    uid: authUser?.uid ?? '',
    displayName,
    email: member?.email || profile?.correo || authUser?.email || '',
    photoURL: profile?.photoURL || member?.avatarUrl || authUser?.photoURL || '',
    role: 'member',
    // El rol viene del cargo en la directiva (`rolId`); `rol` es el campo antiguo
    // del documento, que para todos los miembros vale 'miembro' y no distingue
    // nada.
    rolId: profile?.rolId ?? '',
    rolNombre: profile?.rolNombre ?? '',
    memberRole: profile?.rolId ?? profile?.rol ?? 'miembro',
    status: profile?.estado ?? member?.status ?? 'activo',
    // Pase de un solo uso: mientras este puesto, la sesion no pasa del formulario
    // de cambio de clave.
    debeCambiarClave: profile?.debeCambiarClave === true,
    idMiembros: Number(member?.id ?? profile?.idMiembros ?? 0) || '',
    memberId: member?.memberId ?? '',
    codigoMiembro: memberCode,
    permisos: mergeMemberPermissions(profile?.permisos),
    alcance: mergeMemberScope(profile?.alcance, member),
    // Todos sus cargos, no solo el principal: los permisos se suman y la barra
    // lateral los muestra debajo de su nombre.
    cargos: profile?.cargos ?? [],
    permisosRol: profile?.permisosRol ?? [],
    restricciones: profile?.restricciones ?? {},
  };
};
