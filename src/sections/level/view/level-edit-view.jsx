'use client';

import { paths } from 'src/routes/paths';

import { DashboardContent } from 'src/layouts/dashboard';

import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

import { LevelCreateEditForm } from '../level-create-edit-form';

// ----------------------------------------------------------------------

export function LevelEditView({ level: currentLevel }) {
  return (
    <DashboardContent>
      <CustomBreadcrumbs
        heading="Edit"
        backHref={paths.dashboard.level.list}
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Level', href: paths.dashboard.level.root },
          { name: currentLevel?.name },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <LevelCreateEditForm currentLevel={currentLevel} />
    </DashboardContent>
  );
}
