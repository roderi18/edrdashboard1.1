'use client';

import { removeLastSlash } from 'minimal-shared/utils';

import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';
import { useParams, usePathname } from 'src/routes/hooks';

import { _memberList } from 'src/_mock';
import { DashboardContent } from 'src/layouts/dashboard';

import { Iconify } from 'src/components/iconify';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

// ----------------------------------------------------------------------

export function MemberEditLayout({ children, ...other }) {
  const pathname = usePathname();
  const params = useParams();
  const memberId = params?.id;
  const member = _memberList.find((m) => m.id === memberId);
  const memberName = member?.name || 'Miembro';
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const NAV_ITEMS = [
    {
      label: 'General',
      icon: <Iconify width={24} icon="solar:user-id-bold" />,
      href: paths.dashboard.level.member.edit(memberId),
    },
    // {
    //     label: 'Destacamento',
    //     icon: <Iconify width={24} icon="solar:buildings-bold" />,
    //     href: `/dashboard/level/dest/${member?.destId}/edit`,
    // },
    {
      label: 'Dispensa Médica',
      icon: <Iconify width={24} icon="solar:heart-pulse-bold" />,
      href: paths.dashboard.level.member.editHealth(memberId),
    },
    {
      label: 'Sistema de Ascenso',
      icon: <Iconify width={24} icon="solar:medal-ribbon-star-bold" />,
      href: paths.dashboard.level.member.editAwards(memberId),
    },
    {
      label: 'Padres',
      icon: <Iconify width={24} icon="solar:users-group-rounded-bold" />,
      href: paths.dashboard.level.member.editParents(memberId),
    },
    {
      label: 'Historial',
      icon: <Iconify width={24} icon="solar:history-bold" />,
      href: paths.dashboard.level.member.editHistory(memberId),
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

      <Tabs value={removeLastSlash(pathname)} sx={{ mb: { xs: 3, md: 5 } }}>
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
