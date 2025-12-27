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
        heading="Create a new national"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'National', href: paths.dashboard.national.root },
          { name: 'Create' },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <NationalCreateEditForm />
    </DashboardContent>
  );
}
