'use client';


import { paths } from 'src/routes/paths';

import { DashboardContent } from 'src/layouts/dashboard';

import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

import { MemberCreateEditForm } from '../member-create-edit-form';

// ----------------------------------------------------------------------

export function MemberEditView({ member: currentMember }) {
  return (
    <DashboardContent>
      <CustomBreadcrumbs
        heading="Editar"
        backHref={paths.dashboard.level.member}
        links={[
          { name: 'Panel', href: paths.dashboard.root },
          { name: 'Miembros', href: paths.dashboard.level.member.root },
          { name: currentMember?.name },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <MemberCreateEditForm currentMember={currentMember} />
    </DashboardContent>
  );
}
