'use client';

import { useRef, useEffect } from 'react';
import { removeLastSlash } from 'minimal-shared/utils';

import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Button from '@mui/material/Button';

import { paths } from 'src/routes/paths';
import { usePathname } from 'src/routes/hooks';
import { RouterLink } from 'src/routes/components';

import { DashboardContent } from 'src/layouts/dashboard';

import { Iconify } from 'src/components/iconify';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

// ----------------------------------------------------------------------

const NAV_ITEMS = [
  {
    label: 'Administradores',
    icon: <Iconify width={24} icon="solar:users-group-rounded-bold" />,
    href: paths.dashboard.admin.root,
  },
  {
    label: 'Historial - Logs',
    icon: <Iconify width={24} icon="solar:document-text-bold" />,
    href: paths.dashboard.admin.logs,
  },
  {
    label: 'Permisos a usuarios',
    icon: <Iconify width={24} icon="solar:shield-user-bold" />,
    href: paths.dashboard.admin.userPermissions,
  },
  {
    label: 'Notificaciones',
    icon: <Iconify width={24} icon="solar:bell-bing-bold" />,
    href: paths.dashboard.admin.notifications,
  },
];

const resolveTabValue = (pathname) => {
  const currentPath = removeLastSlash(pathname);
  const exactTab = NAV_ITEMS.find((item) => currentPath === item.href);
  const nestedTab = [...NAV_ITEMS]
    .sort((a, b) => b.href.length - a.href.length)
    .find((item) => currentPath === item.href || currentPath.startsWith(`${item.href}/`));

  return exactTab?.href || nestedTab?.href || paths.dashboard.admin.root;
};

export function AdminTabsLayout({ action = null, children, ...other }) {
  const tabsRef = useRef(null);
  const pathname = usePathname();
  const tabValue = resolveTabValue(pathname);
  const resolvedAction = action ?? (
    <Button
      component={RouterLink}
      href={paths.dashboard.admin.new}
      variant="contained"
      startIcon={<Iconify icon="mingcute:add-line" />}
    >
      Crear administrador
    </Button>
  );

  useEffect(() => {
    const activeTab = tabsRef.current?.querySelector('[data-admin-tab-active="true"]');

    activeTab?.scrollIntoView({
      block: 'nearest',
      inline: 'center',
      behavior: 'smooth',
    });
  }, [tabValue]);

  return (
    <DashboardContent {...other}>
      <CustomBreadcrumbs
        heading="Administradores"
        links={[{ name: 'Panel', href: paths.dashboard.root }, { name: 'Administradores' }]}
        action={resolvedAction}
        sx={{ mb: 3 }}
      />

      <Tabs
        ref={tabsRef}
        value={tabValue}
        variant="scrollable"
        scrollButtons={false}
        sx={{
          mb: { xs: 3, md: 5 },
          '& .MuiTabs-flexContainer': {
            gap: { xs: '28px', md: '42px' },
          },
          '& .MuiTabs-scroller': {
            scrollBehavior: 'smooth',
          },
          '& .MuiTab-root': {
            minHeight: 48,
            minWidth: 0,
            px: 0,
          },
        }}
      >
        {NAV_ITEMS.map((tab) => (
          <Tab
            component={RouterLink}
            key={tab.href}
            label={tab.label}
            icon={tab.icon}
            value={tab.href}
            href={tab.href}
            data-admin-tab-active={tab.href === tabValue ? 'true' : 'false'}
          />
        ))}
      </Tabs>

      {children}
    </DashboardContent>
  );
}
