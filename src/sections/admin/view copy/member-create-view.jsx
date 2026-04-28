'use client';

import { paths } from 'src/routes/paths';

import { DashboardContent } from 'src/layouts/dashboard';

import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

import { MemberCreateEditForm } from '../member-create-edit-form';

// ----------------------------------------------------------------------

export function MemberCreateView() {
  return (
    <DashboardContent>
      <CustomBreadcrumbs
        heading="Crear un nuevo miembro"
        links={[
          { name: 'Panel', href: paths.dashboard.root },
          { name: 'Miembros', href: paths.dashboard.level.member.root },
          { name: 'Crear' },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <MemberCreateEditForm />
    </DashboardContent> //reflog
  );
}
