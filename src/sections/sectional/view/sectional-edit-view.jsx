'use client';


import { paths } from 'src/routes/paths';

import { DashboardContent } from 'src/layouts/dashboard';

import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

import { SectionalCreateEditForm } from '../sectional-create-edit-form';

// ----------------------------------------------------------------------

export function SectionalEditView({ sectional: currentSectional }) {
  return (
    <DashboardContent>
      <CustomBreadcrumbs
        heading="Edit"
        backHref={paths.dashboard.level.sectional}
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Sectional', href: paths.dashboard.level.sectional.root },
          { name: currentSectional?.name },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <SectionalCreateEditForm currentSectional={currentSectional} />
    </DashboardContent>
  );
}
