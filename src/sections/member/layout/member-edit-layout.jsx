'use client';

import { useState, useEffect } from 'react';
import { removeLastSlash } from 'minimal-shared/utils';

import { paths } from 'src/routes/paths';
import { useParams, useRouter, usePathname, useSearchParams } from 'src/routes/hooks';

import { getMemberFullName } from 'src/utils/get-member-fullname';
import {
  isGroupLeaderRole,
  isPastorDestacamentoRole,
  isDestacamentoApprovalRole,
} from 'src/utils/member-access';

import { DashboardContent } from 'src/layouts/dashboard';
import {
  getResolvedMemberByIdentifier,
  getCachedResolvedMemberByIdentifier,
} from 'src/services/member-context-service';

import { Iconify } from 'src/components/iconify';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

import { OrganizationalTab } from 'src/sections/common/organizational-tab';
import { OrganizationalTabs } from 'src/sections/common/organizational-tabs';
import { MemberSensitiveInfoBanner } from 'src/sections/member/member-sensitive-info-banner';

import { useAuthContext } from 'src/auth/hooks';

// ----------------------------------------------------------------------

export function MemberEditLayout({ children, member = null, ...other }) {
  const { user } = useAuthContext();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const params = useParams();
  const memberId = params?.id;
  const [resolvedMember, setResolvedMember] = useState(member);
  // EL PERFIL HISTORICO NO ES UNA FICHA DE MIEMBRO.
  //
  // Es la instantanea de quien ocupo un cargo en un cuatrienio, y llega por el
  // mismo sitio que la ficha. Sin esto se le pintaba encima la cabecera de
  // miembro: el titulo "Miembro", unas migas con el id del integrante
  // (`2022-2026__nacional__nacional__director`) en vez de un nombre, y las cinco
  // pestañas —Dispensa Medica, Padres, Historial— que ahi no llevan a nada.
  // Lo mira la pagina con estos mismos dos parametros.
  const esPerfilHistorico = Boolean(
    searchParams?.get('cuatrienio') && searchParams?.get('integrante')
  );

  useEffect(() => {
    // Su "miembro" es el id del integrante, que no esta en el padron: buscarlo
    // era pedir la lista entera para no encontrar nada.
    if (esPerfilHistorico) return undefined;

    if (member) {
      setResolvedMember(member);
      return undefined;
    }

    const cachedMember = getCachedResolvedMemberByIdentifier(memberId, {
      includeMetadata: true,
      includePhoto: false,
    });

    if (cachedMember) {
      setResolvedMember(cachedMember);
    }

    let cancelled = false;

    const loadMember = async () => {
      const loadedMember =
        cachedMember ||
        (await getResolvedMemberByIdentifier(memberId, {
          includeMetadata: true,
          includePhoto: false,
        }));

      if (!cancelled && loadedMember) setResolvedMember(loadedMember);

      const memberWithPhoto = await getResolvedMemberByIdentifier(memberId, {
        includeMetadata: true,
        includePhoto: true,
      });

      if (!cancelled && memberWithPhoto) setResolvedMember(memberWithPhoto);
    };

    // La cabecera es un extra: si la ficha no se puede leer se queda con el
    // nombre que ya hubiera, pero el rechazo no puede quedar sin dueño o Next
    // lo pinta encima de la pestaña que si cargo.
    void loadMember().catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [esPerfilHistorico, member, memberId]);

  const currentMember = member || resolvedMember;
  const vieneDeConsejoNacional = searchParams?.get('origen') === 'consejo-nacional';
  const memberCode = currentMember?.memberId || currentMember?.codigoMiembro || memberId;
  const memberName = getMemberFullName(currentMember) || currentMember?.name || memberCode || 'Miembro';
  const destacamentoLabel = [
    currentMember?.destName || currentMember?.destacamentoName || currentMember?.nombreDestacamento,
    currentMember?.destNumber || currentMember?.numeroDestacamento || currentMember?.number,
  ]
    .filter(Boolean)
    .join(' ');
  const memberHeading = destacamentoLabel
    ? `Miembro de Dest. ${destacamentoLabel}`
    : 'Miembro';
  const canonicalMemberSegment = encodeURIComponent(String(memberCode || memberId || ''));
  const currentMemberSegment = `/member/${memberId}/`;
  const nextMemberSegment = `/member/${canonicalMemberSegment}/`;
  const canonicalPathname =
    memberCode && String(memberCode) !== String(memberId) && pathname.includes(currentMemberSegment)
      ? pathname.replace(currentMemberSegment, nextMemberSegment)
      : pathname;

  useEffect(() => {
    if (!memberCode || String(memberCode) === String(memberId)) return;

    if (pathname.includes(currentMemberSegment)) {
      // Preservar el query string (p. ej. ?solicitud= / ?resultado=): usePathname
      // no lo incluye, y sin el se perderia al normalizar el id a codigo.
      const search = typeof window !== 'undefined' ? window.location.search : '';

      router.replace(`${pathname.replace(currentMemberSegment, nextMemberSegment)}${search}`);
    }
  }, [currentMemberSegment, memberCode, memberId, nextMemberSegment, pathname, router]);

  // Los hijos a pelo: `PerfilDirectivaNacional` ya trae su propio
  // DashboardContent y su cabecera ("Perfil de Directiva Nacional 2022-2026"),
  // asi que envolverlo otra vez anidaba dos contenedores. Se pinta desde ahi
  // hacia abajo. Va despues de los hooks para no llamarlos condicionalmente.
  if (esPerfilHistorico) {
    return children;
  }

  // Todos los tabs quedan habilitados. El control de acceso al CONTENIDO de cada
  // módulo se maneja dentro de cada vista y con el aviso de "información oculta"
  // (MemberSensitiveInfoBanner), que se muestra en las pestañas donde el usuario
  // no tiene acceso pleno.
  const NAV_ITEMS = [
    {
      label: 'General',
      icon: <Iconify width={24} icon="solar:user-id-bold" />,
      href: paths.dashboard.level.member.edit(canonicalMemberSegment),
    },
    // {
    //     label: 'Destacamento',
    //     icon: <Iconify width={24} icon="solar:buildings-bold" />,
    //     href: `/dashboard/level/dest/${member?.destId}/edit`,
    // },
    {
      label: 'Dispensa Médica',
      icon: <Iconify width={24} icon="solar:heart-pulse-bold" />,
      href: paths.dashboard.level.member.editHealth(canonicalMemberSegment),
    },
    {
      label: 'Sistema de Ascenso',
      icon: <Iconify width={24} icon="solar:medal-ribbon-star-bold" />,
      href: paths.dashboard.level.member.editAwards(canonicalMemberSegment),
    },
    {
      label: 'Padres',
      icon: <Iconify width={24} icon="solar:users-group-rounded-bold" />,
      href: paths.dashboard.level.member.editParents(canonicalMemberSegment),
    },
    // Historial: oculto para los cargos de destacamento en flujo de aprobacion
    // (pastor, consejo, capellan), EXCEPTO el Lider de Grupo y Lider Asistente de
    // Grupo, que si deben verlo.
    ...(!isDestacamentoApprovalRole(user) || isGroupLeaderRole(user) || isPastorDestacamentoRole(user)
      ? [
          {
            label: 'Historial',
            icon: <Iconify width={24} icon="solar:history-bold" />,
            href: paths.dashboard.level.member.editHistory(canonicalMemberSegment),
          },
        ]
      : []),
  ];

  return (
    <DashboardContent {...other}>
      <CustomBreadcrumbs
        heading={memberHeading}
        links={[
          { name: 'Panel', href: paths.dashboard.root },
          vieneDeConsejoNacional
            ? { name: 'Consejo Nacional', href: paths.dashboard.level.national }
            : { name: 'Miembros', href: paths.dashboard.level.member.root },
          { name: memberName },
        ]}
        slotProps={{ breadcrumbs: { separator: '•' } }}
        sx={{ mb: 3 }}
      />

      <OrganizationalTabs value={removeLastSlash(canonicalPathname)} sx={{ mb: { xs: 3, md: 5 } }}>
        {NAV_ITEMS.map((tab) => (
          <OrganizationalTab
            key={tab.href}
            value={tab.href}
            tab={tab}
            href={
              vieneDeConsejoNacional
                ? `${tab.href}?origen=consejo-nacional`
                : tab.href
            }
          />
        ))}
      </OrganizationalTabs>

      <MemberSensitiveInfoBanner member={currentMember} />

      {children}
    </DashboardContent>
  );
}
