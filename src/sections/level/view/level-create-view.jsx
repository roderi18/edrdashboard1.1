'use client';

import { paths } from 'src/routes/paths';

import { DashboardContent } from 'src/layouts/dashboard';

import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

import { LevelCreateEditForm } from '../level-create-edit-form';

// ----------------------------------------------------------------------

export function LevelCreateView() {
  return (
    <DashboardContent>
      <CustomBreadcrumbs
        heading="Create a new level"
        links={[
          { name: 'Panel', href: paths.dashboard.root },
          { name: 'Level', href: paths.dashboard.level.root },
          { name: 'Crear' },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <LevelCreateEditForm />
    </DashboardContent>
  );
}
