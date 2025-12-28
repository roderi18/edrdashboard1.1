'use client';


import { paths } from 'src/routes/paths';

import { DashboardContent } from 'src/layouts/dashboard';

import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

import { DestCreateEditForm } from '../dest-create-edit-form';

// ----------------------------------------------------------------------

export function DestEditView({ dest: currentDest }) {
  return (
    <DashboardContent>
      <CustomBreadcrumbs
        heading="Editar"
        backHref={paths.dashboard.level.dest}
        links={[
          { name: 'Panel', href: paths.dashboard.root },
          { name: 'Destacamentos', href: paths.dashboard.level.dest.root },
          { name: currentDest?.name },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <DestCreateEditForm currentDest={currentDest} />
    </DashboardContent>
  );
}
