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
        heading="Create a new member"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Member', href: paths.dashboard.level.member.root },
          { name: 'Create' },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <MemberCreateEditForm />
    </DashboardContent>
  );
}
