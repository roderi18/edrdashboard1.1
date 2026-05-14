import { doc, limit, query, where, getDoc, getDocs, collection } from 'firebase/firestore';

import { paths } from 'src/routes/paths';

import { getMembers } from 'src/services/member-service';
import { FIRESTORE, isFirebaseConfigured } from 'src/lib/firebase';

import { normalizeText } from './normalize-text';
import { loadProfileByUid } from './admin-profile';
import { MEMBER_AUTH_DOMAIN, normalizeMemberUsername } from './member-auth-credentials';

// ----------------------------------------------------------------------

export const isMemberSessionUser = (user) =>
  Boolean(user) && user?.role !== 'admin' && user?.role !== 'administrador';

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

const mergeMemberScope = (scope = {}, member = {}) => ({
  modo: scope?.modo ?? 'destacamento',
  destacamentos:
    Array.isArray(scope?.destacamentos) && scope.destacamentos.length
      ? scope.destacamentos
      : member?.idDestacamento
        ? [Number(member.idDestacamento)]
        : [],
  regiones: Array.isArray(scope?.regiones) ? scope.regiones : [],
  secciones: Array.isArray(scope?.secciones) ? scope.secciones : [],
});

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

export const canMemberManageMembers = (user) => {
  if (isMemberSessionUser(user)) {
    return false;
  }

  const permissions = getMemberPermissions(user);
  const members = permissions.miembros ?? {};

  return Boolean(members.crear || members.editar || members.eliminar || members.subirFoto);
};

export const filterMembersByMemberScope = (members = [], user) => {
  if (!isMemberSessionUser(user)) {
    return members;
  }

  const scope = getMemberScope(user);

  if (scope?.modo !== 'destacamento') {
    return members;
  }

  const allowedDestinations = new Set(
    Array.isArray(scope.destacamentos) ? scope.destacamentos.map((id) => String(id)) : []
  );

  if (!allowedDestinations.size) {
    return [];
  }

  return members.filter((member) => {
    const memberDestId = member?.idDestacamento ?? member?.destId ?? member?.destamentoId ?? '';

    return allowedDestinations.has(String(memberDestId));
  });
};

export const getMemberAllowedDestIds = (user) => {
  if (!isMemberSessionUser(user)) {
    return null;
  }

  const scope = getMemberScope(user);

  if (scope?.modo !== 'destacamento') {
    return null;
  }

  const allowedDestinations = Array.isArray(scope?.destacamentos)
    ? scope.destacamentos.map((id) => String(id))
    : [];

  if (!allowedDestinations.length) {
    return new Set();
  }

  return new Set(allowedDestinations);
};

export const filterDestsByMemberScope = (dests = [], user) => {
  if (!isMemberSessionUser(user)) {
    return dests;
  }

  const allowedDestinations = getMemberAllowedDestIds(user);

  if (allowedDestinations === null) {
    return dests;
  }

  if (!(allowedDestinations instanceof Set) || !allowedDestinations.size) {
    return [];
  }

  return dests.filter((dest) => {
    const destIdCandidates = [
      dest?.id,
      dest?.idDestacamento,
      dest?.destId,
      dest?.destamentoId,
    ].filter((value) => value !== null && value !== undefined && value !== '');

    return destIdCandidates.some((candidate) => allowedDestinations.has(String(candidate)));
  });
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

export const filterDashboardNavDataForMember = (navData = [], user) =>
  navData
    .map((section) => {
      const filterItems = (items = []) =>
        items
          .map((item) => {
            const childItems = item.children ? filterItems(item.children) : [];
            const itemAllowed = navPermissionByItem(item, user);
            const title = normalizeText(item.title || '');
            const isShopItem =
              title.includes('tienda') ||
              title.includes('producto') ||
              item.path === paths.dashboard.product.root;
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
                return itemAllowed
                  ? {
                      ...item,
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
                    }
                  : null;
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

  const profile = normalizeMemberProfile(
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
      },
    member,
    authUser
  );
  const photoURL = await getActiveMemberPhotoUrl(profile.idMiembros ?? member.id);

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
