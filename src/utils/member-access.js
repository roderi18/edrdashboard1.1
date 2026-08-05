import { doc, limit, query, where, getDoc, setDoc, getDocs, collection } from 'firebase/firestore';

import { paths } from 'src/routes/paths';

import { getMembers } from 'src/services/member-service';
import { FIRESTORE, isFirebaseConfigured } from 'src/lib/firebase';

import { PERMISOS } from 'src/auth/permissions/permissions';
import { can, isReadOnlyRole } from 'src/auth/permissions/can';
import { PERMISOS_POR_ROL } from 'src/auth/permissions/role-permissions';
import { ROLES, ALCANCES, ROLES_POR_CODIGO } from 'src/auth/permissions/roles';

import { normalizeText } from './normalize-text';
import { loadProfileByUid } from './admin-profile';
import { MEMBER_AUTH_DOMAIN, normalizeMemberUsername } from './member-auth-credentials';

// ----------------------------------------------------------------------

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

const isSectionWideRole = (user = {}) =>
  [ROLES.USUARIO_DESTACAMENTO, ROLES.USUARIO_SECCION].includes(getScopeUserRoleId(user));

// Ya ningún cargo ve la lista COMPLETA por ser "de nivel": los regionales ven su
// región (isRegionScopedMemberViewer) y los seccionales su sección
// (isSectionScopedMemberViewer). Los cargos nacional/global ven todo por la vía
// del fallthrough (sin modo de alcance acotado), no por esta función.
const isOrgWideViewerRole = () => false;

// Cargos regionales que consultan miembros SOLO dentro de su región: Coordinador
// Regional, Sub-Director Regional y los 4 coordinadores de área regional.
const REGION_SCOPED_MEMBER_VIEW_ROLE_IDS = [
  ROLES.USUARIO_REGION,
  ROLES.USUARIO_REGION_ASISTENTE,
  ROLES.COORDINADOR_ADIESTRAMIENTO_REGION,
  ROLES.COORDINADOR_PROMOCION_REGION,
  ROLES.COORDINADOR_PRODUCCION_REGION,
  ROLES.COORDINADOR_PROGRAMA_REGION,
  ROLES.CAPELLAN_REGIONAL,
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
  // Cargos de consulta de nivel sección.
  ROLES.CAPELLAN_SECCIONAL,
  ROLES.SECRETARIO_REGIONAL,
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

  await setDoc(
    doc(FIRESTORE, 'usuarios_roles', authUid),
    {
      ...sourceProfile,
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

export const canMemberManageMembers = (user) => {
  if (isMemberSessionUser(user)) {
    return false;
  }

  const permissions = getMemberPermissions(user);
  const members = permissions.miembros ?? {};

  return Boolean(members.crear || members.editar || members.eliminar || members.subirFoto);
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

  // Cargos seccionales: consulta acotada a los miembros de SU sección (por sección
  // directa del miembro, o por su destacamento dentro de la sección).
  if (isSectionScopedMemberViewer(user)) {
    const { dests = [], churches = [] } = context;

    // Sección del alcance explícito; si no hay, se deriva de la propia membresía.
    let sectionIds = new Set(getScopeSectionIds(getMemberScope(user)));
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

  // Cargos seccionales: la lista de destacamentos se acota a su sección.
  if (isSectionScopedMemberViewer(user)) {
    const { dests = [], churches = [] } = context;

    // Sin lista de destacamentos en el contexto no podemos acotar; no sobre-restringir.
    if (!dests.length) return null;

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
  GROUP_LEADER_ROLE_IDS.includes(getScopeUserRoleId(user));

// Cargos del destacamento que NO son coordinadores: editan a sus miembros pero
// sus cambios (General y Dispensa Médica) van a APROBACION del Coordinador de
// Destacamento (mismo flujo/bloqueos que el Lider de Grupo). En Documentos de
// salud pueden subir pero no eliminar.
// El Pastor NO va aqui: es de SOLO LECTURA (no edita, ni siquiera por
// aprobacion); su formulario se renderiza en solo lectura completo.
const DESTACAMENTO_APPROVAL_ROLE_IDS = [
  ROLES.LIDER_GRUPO,
  ROLES.LIDER_ASISTENTE_GRUPO,
];

export const isDestacamentoApprovalRole = (user = {}) =>
  DESTACAMENTO_APPROVAL_ROLE_IDS.includes(getScopeUserRoleId(user));

// Coordinador de Destacamento (titular y asistente comparten alcance; el
// asistente se normaliza a titular en getScopeUserRoleId). Tienen acceso total.
export const isCoordinadorDestacamentoRole = (user = {}) =>
  getScopeUserRoleId(user) === ROLES.USUARIO_DESTACAMENTO;

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

const CONSEJO_NACIONAL_HEALTH_VIEWER_ROLE_IDS = new Set([
  ROLES.MINISTERIOS_INFANTILES_NACIONAL,
  ROLES.DIRECTOR_NACIONAL,
  ROLES.CAPELLAN_NACIONAL,
  ROLES.COORDINADOR_ADIESTRAMIENTO_NACIONAL,
  ROLES.SUBDIRECTOR_NACIONAL,
  ROLES.COORDINADOR_PROMOCION_NACIONAL,
  ROLES.COORDINADOR_PRODUCCION_NACIONAL,
  ROLES.COORDINADOR_PROGRAMA_NACIONAL,
  ROLES.COMITES_ESPECIALES_NACIONAL,
  ROLES.OFICIALES_ADIESTRAMIENTOS_ESPECIALES_NACIONAL,
]);

export const isConsejoNacionalHealthViewer = (user = {}) =>
  CONSEJO_NACIONAL_HEALTH_VIEWER_ROLE_IDS.has(
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

// Los cargos del Consejo Nacional tienen acceso completo de consulta a Salud,
// pero nunca modifican el expediente ni gestionan sus documentos.
export const canEditHealth = (user = {}) =>
  !isConsejoNacionalHealthViewer(user) && puedeEditarPorCatalogo(user, PERMISOS.SALUD_EDITAR);

export const canUploadHealthDocuments = (user = {}) =>
  !isConsejoNacionalHealthViewer(user) &&
  puedeEditarPorCatalogo(user, PERMISOS.SALUD_SUBIR_DOCUMENTOS);

export const canDeleteHealthDocuments = (user = {}) =>
  !isConsejoNacionalHealthViewer(user) &&
  puedeEditarPorCatalogo(user, PERMISOS.SALUD_ELIMINAR_DOCUMENTOS);

export const canAuthorizeMinorHealthAccess = (user = {}) =>
  puedeEditarPorCatalogo(user, PERMISOS.SALUD_AUTORIZAR_ACCESO_MENORES);

export const canViewAwards = (user = {}) => puedePorCatalogo(user, PERMISOS.ASCENSO_VER);

export const canEditAwards = (user = {}) => puedeEditarPorCatalogo(user, PERMISOS.ASCENSO_EDITAR);

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
export const canViewMemberSensitiveData = (user = {}) =>
  FULL_MEMBER_TEXT_ROLE_IDS.has(getUserRoleId(user)) ||
  puedePorCatalogo(user, PERMISOS.MIEMBROS_VER_DATOS_SENSIBLES);

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

// El Historial expone cambios de datos generales, salud y ascenso: se habilita a
// los visores completos y a quienes pueden ver salud o padres (no basta con
// ascenso solo, para no exponer el resto de módulos).
export const canViewMemberHistoryTab = (user = {}) =>
  isFullMemberViewer(user) || canViewHealth(user) || canViewParents(user);

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
export const getOwnDestIdsForUser = (user = {}) => {
  const scope = getMemberScope(user);
  const ids = new Set(getScopeDestIds(scope));
  const ownDestId = normalizeScopeId(
    user?.idDestacamento ?? user?.destId ?? user?.destamentoId ?? scope?.destacamentoId ?? scope?.idDestacamento
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
  // secciones).
  if (
    getScopeUserRoleId(user) === ROLES.USUARIO_DESTACAMENTO ||
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
  if (title.includes('administrador')) return Boolean(permissions.administradores?.ver);
  if (title.includes('destacamento')) return Boolean(permissions.destacamentos?.ver);
  if (title.includes('asistencia') || path.includes('/dashboard/level/attendance')) {
    return canViewAdminModule(permissions, 'asistencia', user);
  }
  // Los niveles organizacionales superiores (sección, región y consejo nacional)
  // no viven en el objeto `permisos` del miembro, así que además del objeto se
  // consulta el catálogo por rol (`can`). Esto permite que cargos de consulta
  // nacional —p. ej. el Director Nacional— vean todos los niveles en el menú.
  if (title.includes('seccion')) {
    return Boolean(permissions.secciones?.ver) || can(user, PERMISOS.SECCIONES_VER);
  }
  if (title.includes('region') || title.includes('consejo nacional')) {
    return (
      Boolean(permissions.regiones?.ver || permissions.nacional?.ver) ||
      can(user, PERMISOS.REGIONES_VER) ||
      can(user, PERMISOS.REPORTES_VER_NACIONALES)
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

// El Usuario Común solo tiene acceso de lectura al Sistema de Ascenso: no puede
// agregar ni cambiar nada (los demas cargos del destacamento con acceso si).
export const isUsuarioComunRole = (user = {}) =>
  getUserRoleId(user) === ROLES.USUARIO_COMUN;

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

const MODULE_PERMISSION_BY_KEY = {
  asistencia: 'asistencia.ver',
  destacamentos: 'destacamentos.ver',
  miembros: 'miembros.ver',
  secciones: 'secciones.ver',
  regiones: 'reportes.ver_regionales',
  productos: 'tienda.ver',
};

const canViewAdminModule = (permissions = {}, moduleKey, user = {}) => {
  if (!hasExplicitPermissions(permissions)) {
    const permissionCode = MODULE_PERMISSION_BY_KEY[moduleKey];

    return permissionCode ? getAuthorizationPermissionCodes(user).includes(permissionCode) : true;
  }

  if (!moduleKey) {
    return true;
  }

  if (permissions[moduleKey]?.ver) {
    return true;
  }

  const permissionCode = MODULE_PERMISSION_BY_KEY[moduleKey];

  return permissionCode ? getAuthorizationPermissionCodes(user).includes(permissionCode) : false;
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
    const profile = normalizeMemberProfile(profileByUid, minimalMember, authUser);
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
  const profile = normalizeMemberProfile(sourceProfile, member, authUser);
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
    memberRole: profile?.rol ?? 'miembro',
    status: profile?.estado ?? member?.status ?? 'activo',
    idMiembros: Number(member?.id ?? profile?.idMiembros ?? 0) || '',
    memberId: member?.memberId ?? '',
    codigoMiembro: memberCode,
    permisos: mergeMemberPermissions(profile?.permisos),
    alcance: mergeMemberScope(profile?.alcance, member),
  };
};
