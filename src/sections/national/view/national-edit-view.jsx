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
        heading="Editar"
        backHref={paths.dashboard.level.national}
        links={[
          { name: 'Panel', href: paths.dashboard.root },
          { name: 'Nacional', href: paths.dashboard.level.national.root },
          { name: currentNational?.name },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <NationalCreateEditForm currentNational={currentNational} />
    </DashboardContent>
  );
}
