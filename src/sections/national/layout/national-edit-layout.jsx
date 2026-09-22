'use client';

import { paths } from 'src/routes/paths';
import { useParams, usePathname } from 'src/routes/hooks';

import { DashboardContent } from 'src/layouts/dashboard';

import { Iconify } from 'src/components/iconify';

import { OrganizationalTab } from 'src/sections/common/organizational-tab';
import { OrganizationalTabs } from 'src/sections/common/organizational-tabs';


// ----------------------------------------------------------------------

// ----------------------------------------------------------------------

export function NationalEditLayout({ children, ...other }) {
  const pathname = usePathname();
  const params = useParams();
  const nationalId = params?.id;

  const currentPath = pathname.replace(/\/$/, '');
  const editHref = paths.dashboard.level.national.edit(nationalId);
  const leadershipHref = `/dashboard/level/national/${nationalId}/edit/leadership`;

  const navItems = [
    {
      label: 'General',
      icon: <Iconify width={24} icon="solar:buildings-bold" />,
      href: editHref,
    },
    {
      label: 'Directiva',
      icon: <Iconify width={24} icon="solar:users-group-rounded-bold" />,
      href: leadershipHref,
    },
  ];

  return (
    <DashboardContent {...other}>
      <OrganizationalTabs value={currentPath} sx={{ mb: { xs: 3, md: 5 } }}>
        {navItems.map((tab) => (
          <OrganizationalTab
            key={tab.href}
            value={tab.href}
            tab={tab}
          />
        ))}
      </OrganizationalTabs>

      {children}
    </DashboardContent>
  );
}
