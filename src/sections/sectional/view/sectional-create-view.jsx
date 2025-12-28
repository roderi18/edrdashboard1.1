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
        heading="Create a new sectional"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Sectional', href: paths.dashboard.level.sectional.root },
          { name: 'Create' },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <SectionalCreateEditForm />
    </DashboardContent>
  );
}
