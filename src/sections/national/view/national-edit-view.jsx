'use client';


import { paths } from 'src/routes/paths';

import { DashboardContent } from 'src/layouts/dashboard';

import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

import { NationalCreateEditForm } from '../national-create-edit-form';

// ----------------------------------------------------------------------

export function NationalEditView({ national: currentNational }) {
  return (
    <DashboardContent>
      <CustomBreadcrumbs
        heading="Edit"
        backHref={paths.dashboard.level.national.list}
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'National', href: paths.dashboard.level.national.root },
          { name: currentNational?.name },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <NationalCreateEditForm currentNational={currentNational} />
    </DashboardContent>
  );
}
