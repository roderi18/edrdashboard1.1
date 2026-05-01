'use client';

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
];

export function AdminTabsLayout({ action = null, children, ...other }) {
  const pathname = usePathname();
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

  return (
    <DashboardContent {...other}>
      <CustomBreadcrumbs
        heading="Administradores"
        links={[{ name: 'Panel', href: paths.dashboard.root }, { name: 'Administradores' }]}
        action={resolvedAction}
        sx={{ mb: 3 }}
      />

      <Tabs
        value={removeLastSlash(pathname)}
        sx={{
          mb: { xs: 3, md: 5 },
          '& .MuiTabs-flexContainer': {
            gap: '42px',
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
          />
        ))}
      </Tabs>

      {children}
    </DashboardContent>
  );
}
