'use client';


import { paths } from 'src/routes/paths';

import { DashboardContent } from 'src/layouts/dashboard';

import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

import { RegionalCreateEditForm } from '../regional-create-edit-form';

// ----------------------------------------------------------------------

export function RegionalEditView({ regional: currentRegional }) {
  return (
    <DashboardContent>
      <CustomBreadcrumbs
        heading="Editar"
        backHref={paths.dashboard.level.regional}
        links={[
          { name: 'Panel', href: paths.dashboard.root },
          { name: 'Regional', href: paths.dashboard.level.regional.root },
          { name: currentRegional?.name },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <RegionalCreateEditForm currentRegional={currentRegional} />
    </DashboardContent>
  );
}
