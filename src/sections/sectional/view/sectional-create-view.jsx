'use client';

import { paths } from 'src/routes/paths';

import { DashboardContent } from 'src/layouts/dashboard';

import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

import { SectionalCreateEditForm } from '../sectional-create-edit-form';

// ----------------------------------------------------------------------

export function SectionalCreateView() {
  return (
    <DashboardContent>
      <CustomBreadcrumbs
        heading="Crear un nuevo seccional"
        links={[
          { name: 'Panel', href: paths.dashboard.root },
          { name: 'Seccional', href: paths.dashboard.level.sectional.root },
          { name: 'Crear' },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <SectionalCreateEditForm />
    </DashboardContent>
  );
}
