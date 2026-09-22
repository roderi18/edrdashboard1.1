'use client';

import Tabs from '@mui/material/Tabs';

import { paths } from 'src/routes/paths';

import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

import { OrganizationalTab } from './organizational-tab';

// Cabecera comun de las fichas organizacionales: nombre, pestañas y la ruta de
// la pestaña activa. Mantener esta composición aqui evita que un nivel cambie
// el orden o el separador respecto de los demás.
export function OrganizationalProfileNavigation({ heading, nivel, nivelHref, tabs, value }) {
  const tabActual = tabs.find((tab) => tab.href === value) || tabs[0];

  return (
    <>
      <CustomBreadcrumbs heading={heading} sx={{ mb: 3 }} />

      <Tabs value={value} sx={{ mb: 2 }}>
        {tabs.map((tab) => (
          <OrganizationalTab key={tab.href} tab={tab} value={tab.href} />
        ))}
      </Tabs>

      <CustomBreadcrumbs
        links={[
          { name: 'Panel', href: paths.dashboard.root },
          { name: nivel, href: nivelHref },
          { name: tabActual.label },
        ]}
        slotProps={{ breadcrumbs: { separator: '•' } }}
        sx={{ mb: { xs: 3, md: 5 } }}
      />
    </>
  );
}
