'use client';

import { useState, useEffect } from 'react';

import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';
import { useParams, usePathname } from 'src/routes/hooks';

import { DashboardContent } from 'src/layouts/dashboard';
import { getRegionals } from 'src/services/regional-service';

import { Iconify } from 'src/components/iconify';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

// ----------------------------------------------------------------------

export function RegionalEditLayout({ children, ...other }) {
  const pathname = usePathname();
  const params = useParams();
  const regionalId = params?.id;
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [regionalName, setRegionalName] = useState('Región');

  useEffect(() => {
    const loadRegional = async () => {
      const regionals = await getRegionals();
      const regional = (Array.isArray(regionals) ? regionals : []).find(
        (item) => String(item.id) === String(regionalId)
      );

      setRegionalName(regional?.name || 'Región');
    };

    if (regionalId) {
      loadRegional();
    }
  }, [regionalId]);

  const currentPath = pathname.replace(/\/$/, '');
  const editHref = paths.dashboard.level.regional.edit(regionalId);
  const leadershipHref = `/dashboard/level/regional/${regionalId}/edit/leadership`;

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
        heading={isMobile ? null : 'Editar región'}
        links={[
          { name: 'Panel', href: paths.dashboard.root },
          { name: 'Regiones', href: paths.dashboard.level.regional.root },
          { name: regionalName },
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
