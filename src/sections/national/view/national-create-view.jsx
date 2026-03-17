'use client';

import { paths } from 'src/routes/paths';

import { DashboardContent } from 'src/layouts/dashboard';

import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

import { NationalCreateEditForm } from '../national-create-edit-form';

// ----------------------------------------------------------------------

export function NationalCreateView() {
  return (
    <DashboardContent>
      <CustomBreadcrumbs
        heading="Crear un nuevo nacional"
        links={[
          { name: 'Panel', href: paths.dashboard.root },
          { name: 'Nacional', href: paths.dashboard.level.national.root },
          { name: 'Crear' },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <NationalCreateEditForm />
    </DashboardContent>
  );
}
