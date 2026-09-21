'use client';

import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';
import { useParams, usePathname } from 'src/routes/hooks';

import { DashboardContent } from 'src/layouts/dashboard';

import { Iconify } from 'src/components/iconify';


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
      <Tabs value={currentPath} sx={{ mb: { xs: 3, md: 5 } }}>
        {navItems.map((tab) => (
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
