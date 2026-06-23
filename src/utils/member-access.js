import { doc, limit, query, where, getDoc, setDoc, getDocs, collection } from 'firebase/firestore';

import { paths } from 'src/routes/paths';

import { getMembers } from 'src/services/member-service';
import { FIRESTORE, isFirebaseConfigured } from 'src/lib/firebase';

import { ROLES, ALCANCES } from 'src/auth/permissions/roles';
import { PERMISOS_POR_ROL } from 'src/auth/permissions/role-permissions';

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

const getScopeUserRoleId = (user = {}) =>
  String(user?.rolId || user?.roleId || user?.rolCodigo || user?.roleCodigo || user?.memberRole || '')
    .trim()
    .toLowerCase();

const isSectionWideRole = (user = {}) =>
  [ROLES.USUARIO_DESTACAMENTO, ROLES.USUARIO_SECCION].includes(getScopeUserRoleId(user));

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

export const filterMembersByMemberScope = (members = [], user, context = {}) => {
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

export const filterSectionalsByMemberScope = (
  sectionals = [],
  user,
  { dests = [], churches = [] } = {}
) => {
  const scope = getMemberScope(user);
  const scopeMode = getScopeMode(scope, user);

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
  if (title.includes('seccion')) return Boolean(permissions.secciones?.ver);
  if (title.includes('region') || title.includes('consejo nacional')) {
    return Boolean(permissions.regiones?.ver || permissions.nacional?.ver);
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

const hasStoreAdminAccess = (user = {}) => STORE_ADMIN_ROLE_IDS.has(getUserRoleId(user));

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

export const filterDashboardNavDataByUser = (navData = [], user) => {
  if (isMemberSessionUser(user)) {
    return filterDashboardNavDataForMember(navData, user);
  }

  if (!isAdminSessionUser(user)) {
    return navData;
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

  return navData
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

  await syncRoleProfileByAuthUid({ authUser, sourceProfile, profile, member });

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
