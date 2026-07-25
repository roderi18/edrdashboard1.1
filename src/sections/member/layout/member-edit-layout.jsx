'use client';

import { useEffect } from 'react';
import { removeLastSlash } from 'minimal-shared/utils';

import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';
import { useParams, useRouter, usePathname } from 'src/routes/hooks';

import { getMemberFullName } from 'src/utils/get-member-fullname';
import {
  isGroupLeaderRole,
  canViewMemberHealthTab,
  canViewMemberAwardsTab,
  canViewMemberParentsTab,
  canViewMemberHistoryTab,
  isDestacamentoApprovalRole,
} from 'src/utils/member-access';

import { DashboardContent } from 'src/layouts/dashboard';

import { Iconify } from 'src/components/iconify';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

import { MemberSensitiveInfoBanner } from 'src/sections/member/member-sensitive-info-banner';

import { useAuthContext } from 'src/auth/hooks';

// ----------------------------------------------------------------------

export function MemberEditLayout({ children, member = null, ...other }) {
  const { user } = useAuthContext();
  const pathname = usePathname();
  const router = useRouter();
  const params = useParams();
  const memberId = params?.id;
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const memberCode = member?.memberId || member?.codigoMiembro || memberId;
  const memberName = getMemberFullName(member) || member?.name || memberCode || 'Miembro';
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

  // El tab General siempre está disponible para quien puede ver miembros. Los
  // demás módulos (Dispensa Médica, Padres, Historial) se habilitan según el
  // permiso puntual del usuario; p. ej. el Director Nacional solo suma el Sistema
  // de Ascenso y ve el resto DESHABILITADO.
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
      disabled: !canViewMemberHealthTab(user),
    },
    {
      label: 'Sistema de Ascenso',
      icon: <Iconify width={24} icon="solar:medal-ribbon-star-bold" />,
      href: paths.dashboard.level.member.editAwards(canonicalMemberSegment),
      disabled: !canViewMemberAwardsTab(user),
    },
    {
      label: 'Padres',
      icon: <Iconify width={24} icon="solar:users-group-rounded-bold" />,
      href: paths.dashboard.level.member.editParents(canonicalMemberSegment),
      disabled: !canViewMemberParentsTab(user),
    },
    // Historial: oculto para los cargos de destacamento en flujo de aprobacion
    // (pastor, consejo, capellan), EXCEPTO el Lider de Grupo y Lider Asistente de
    // Grupo, que si deben verlo.
    ...(!isDestacamentoApprovalRole(user) || isGroupLeaderRole(user)
      ? [
          {
            label: 'Historial',
            icon: <Iconify width={24} icon="solar:history-bold" />,
            href: paths.dashboard.level.member.editHistory(canonicalMemberSegment),
            disabled: !canViewMemberHistoryTab(user),
          },
        ]
      : []),
  ];

  return (
    <DashboardContent {...other}>
      {/* <CustomBreadcrumbs
                heading="Editar miembro"
                links={[
                    { name: 'Panel', href: paths.dashboard.root },
                    { name: 'Miembros', href: paths.dashboard.level.member.root },
                    { name: 'Editar' },
                ]}
                sx={{ mb: 3 }}
            /> */}
      <CustomBreadcrumbs
        heading={isMobile ? null : 'Editar miembro'}
        links={[
          { name: 'Panel', href: paths.dashboard.root },
          { name: 'Miembros', href: paths.dashboard.level.member.root },
          { name: memberName },
        ]}
        sx={{ mb: 3 }}
      />

      <Tabs value={removeLastSlash(canonicalPathname)} sx={{ mb: { xs: 3, md: 5 } }}>
        {NAV_ITEMS.map((tab) =>
          tab.disabled ? (
            <Tab key={tab.href} label={tab.label} icon={tab.icon} value={tab.href} disabled />
          ) : (
            <Tab
              component={RouterLink}
              key={tab.href}
              label={tab.label}
              icon={tab.icon}
              value={tab.href}
              href={tab.href}
            />
          )
        )}
      </Tabs>

      <MemberSensitiveInfoBanner member={member} />

      {children}
    </DashboardContent>
  );
}
