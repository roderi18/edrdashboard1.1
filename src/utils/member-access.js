import { collection, getDocs, limit, query, where } from 'firebase/firestore';

import { paths } from 'src/routes/paths';

import { FIRESTORE } from 'src/lib/firebase';
import { getMembers } from 'src/services/member-service';

import { normalizeText } from './normalize-text';
import { loadProfileByUid } from './admin-profile';
import { MEMBER_AUTH_DOMAIN, normalizeMemberUsername } from './member-auth-credentials';

// ----------------------------------------------------------------------

export const isMemberSessionUser = (user) => user?.role === 'member' || user?.role === 'miembro';

export const getMemberPermissions = (user) => user?.permisos ?? user?.permissions ?? {};

export const getMemberScope = (user) => user?.alcance ?? {};

export const getMemberCodeLabel = (user) =>
  String(user?.codigoMiembro ?? user?.memberId ?? user?.codigo ?? '')
    .trim()
    .toUpperCase();

export const buildDefaultMemberPermissions = () => ({
  miembros: {
    ver: true,
    crear: false,
    editar: false,
    eliminar: false,
    subirFoto: false,
  },
  tienda: {
    ver: true,
    comprar: true,
    administrar: false,
    verPedidos: false,
    gestionarProductos: false,
  },
  productos: {
    ver: true,
    crear: false,
    editar: false,
    eliminar: false,
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
  productos: {
    ...buildDefaultMemberPermissions().productos,
    ...(permissions?.productos ?? {}),
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

const navPermissionByItem = (item, user) => {
  const permissions = getMemberPermissions(user);
  const title = normalizeText(item.title || '');
  const path = String(item.path || '');

  if (
    path === paths.dashboard.root ||
    title === 'aplicacion' ||
    title === 'aplicación' ||
    title === 'dashboard'
  ) {
    return true;
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
  if (title.includes('archivo')) return Boolean(permissions.archivos?.ver);
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

            if (item.children) {
              if (itemAllowed || childItems.length) {
                return {
                  ...item,
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
  const email = String(authUser?.email ?? '')
    .trim()
    .toLowerCase();

  if (!email || !email.endsWith(`@${MEMBER_AUTH_DOMAIN}`)) {
    return null;
  }

  const loginValue = email.split('@')[0];
  const normalizedLogin = normalizeMemberUsername(loginValue);
  const members = await getMembers();

  const member = members.find((item) =>
    [item.memberId, item.idMiembros, item.email]
      .filter(Boolean)
      .map((candidate) => normalizeMemberUsername(candidate))
      .includes(normalizedLogin)
  );

  if (!member) {
    return {
      member: null,
      profile: null,
      accessToken: authUser?.accessToken ?? null,
    };
  }

  const directProfile = await loadProfileByUid('usuarios_roles', String(member.id));

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

  return {
    member,
    profile,
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
