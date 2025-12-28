'use client';

import { paths } from 'src/routes/paths';

import { DashboardContent } from 'src/layouts/dashboard';

import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

import { RegionalCreateEditForm } from '../regional-create-edit-form';

// ----------------------------------------------------------------------

export function RegionalCreateView() {
  return (
    <DashboardContent>
      <CustomBreadcrumbs
        heading="Crear un nuevo regional"
        links={[
          { name: 'Panel', href: paths.dashboard.root },
          { name: 'Regional', href: paths.dashboard.level.regional.root },
          { name: 'Crear' },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <RegionalCreateEditForm />
    </DashboardContent>
  );
}
