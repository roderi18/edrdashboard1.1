'use client';

import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';
import { useParams, usePathname } from 'src/routes/hooks';

import { _nationalList } from 'src/_mock/_national';
import { DashboardContent } from 'src/layouts/dashboard';

import { Iconify } from 'src/components/iconify';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

import {
  isLocalhostNationalTestId,
  LOCALHOST_NATIONAL_TEST_EDIT_RECORD,
} from '../national-localhost-test-user';

// ----------------------------------------------------------------------

function getNationalName(nationalId) {
  if (isLocalhostNationalTestId(nationalId)) {
    return LOCALHOST_NATIONAL_TEST_EDIT_RECORD.name;
  }

  const national = _nationalList.find((item) => String(item.id) === String(nationalId));

  return national?.name || national?.nationalXname || 'Nacional';
}

// ----------------------------------------------------------------------

export function NationalEditLayout({ children, ...other }) {
  const pathname = usePathname();
  const params = useParams();
  const nationalId = params?.id;
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const currentPath = pathname.replace(/\/$/, '');
  const nationalName = getNationalName(nationalId);
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
      <CustomBreadcrumbs
        heading={isMobile ? null : 'Editar nacional'}
        links={[
          { name: 'Panel', href: paths.dashboard.root },
          { name: 'Nacional', href: paths.dashboard.level.national.root },
          { name: nationalName },
        ]}
        sx={{ mb: 3 }}
      />

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
