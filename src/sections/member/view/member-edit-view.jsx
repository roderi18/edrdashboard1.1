'use client';


import { paths } from 'src/routes/paths';

import { DashboardContent } from 'src/layouts/dashboard';

import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

import { MemberEditLayout } from 'src/sections/member/layout/member-edit-layout';
import { MemberCreateEditForm } from '../member-create-edit-form';

// ----------------------------------------------------------------------

export function MemberEditView({ member: currentMember }) {
  return (
    <MemberEditLayout>
      <MemberCreateEditForm currentMember={currentMember} />
    </MemberEditLayout>
  );
}