'use client';

import { paths } from 'src/routes/paths';

import { DashboardContent } from 'src/layouts/dashboard';

import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

import { DestCreateEditForm } from '../dest-create-edit-form';

// ----------------------------------------------------------------------

export function DestCreateView() {
  return (
    <DashboardContent>
      <CustomBreadcrumbs
        heading="Crear nuevo Destacamento"
        links={[
          { name: 'Panel', href: paths.dashboard.root },
          { name: 'Destacamentos', href: paths.dashboard.level.dest.root },
          { name: 'Crear' },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <DestCreateEditForm />
    </DashboardContent>
  );
}
