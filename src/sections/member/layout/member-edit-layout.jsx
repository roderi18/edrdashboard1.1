'use client';

import { useState, useEffect } from 'react';
import { removeLastSlash } from 'minimal-shared/utils';

import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';
import { useParams, useRouter, usePathname } from 'src/routes/hooks';

import { getMemberFullName } from 'src/utils/get-member-fullname';

import { getMembers } from 'src/services/member-service';
import { DashboardContent } from 'src/layouts/dashboard';

import { Iconify } from 'src/components/iconify';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

// ----------------------------------------------------------------------

export function MemberEditLayout({ children, ...other }) {
  const pathname = usePathname();
  const router = useRouter();
  const params = useParams();
  const memberId = params?.id;
  const [member, setMember] = useState(null);
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
    let active = true;

    const loadMember = async () => {
      const members = await getMembers();
      const foundMember =
        members.find(
          (item) =>
            String(item.id) === String(memberId) ||
            String(item.memberId) === String(memberId) ||
            String(item.codigoMiembro) === String(memberId)
        ) || null;

      if (active) {
        setMember(foundMember);
      }
    };

    loadMember();

    return () => {
      active = false;
    };
  }, [memberId]);

  useEffect(() => {
    if (!memberCode || String(memberCode) === String(memberId)) return;

    if (pathname.includes(currentMemberSegment)) {
      router.replace(pathname.replace(currentMemberSegment, nextMemberSegment));
    }
  }, [currentMemberSegment, memberCode, memberId, nextMemberSegment, pathname, router]);

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
    {
      label: 'Historial',
      icon: <Iconify width={24} icon="solar:history-bold" />,
      href: paths.dashboard.level.member.editHistory(canonicalMemberSegment),
    },
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
        {NAV_ITEMS.map((tab) => (
          <Tab
            component={RouterLink}
            key={tab.href}
            label={tab.label}
            icon={tab.icon}
            value={tab.href}
            href={tab.href}
          />
        ))}
      </Tabs>

      {children}
    </DashboardContent>
  );
}
