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
        heading="Editar"
        backHref={paths.dashboard.level.sectional}
        links={[
          { name: 'Panel', href: paths.dashboard.root },
          { name: 'Seccional', href: paths.dashboard.level.sectional.root },
          { name: currentSectional?.name },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <SectionalCreateEditForm currentSectional={currentSectional} />
    </DashboardContent>
  );
}
