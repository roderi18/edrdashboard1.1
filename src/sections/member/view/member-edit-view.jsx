'use client';

import Alert from '@mui/material/Alert';

import { paths } from 'src/routes/paths';

import { canMemberManageMembers } from 'src/utils/member-access';

import { DashboardContent } from 'src/layouts/dashboard';

import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

import { MemberEditLayout } from 'src/sections/member/layout/member-edit-layout';

import { useAuthContext } from 'src/auth/hooks';

import { MemberCreateEditForm } from '../member-create-edit-form';

// ----------------------------------------------------------------------

export function MemberEditView({ member: currentMember }) {
  const { user, loading } = useAuthContext();

  if (loading) {
    return null;
  }

  const canManage = !user || user.role !== 'member' ? true : canMemberManageMembers(user);

  if (!canManage) {
    return (
      <DashboardContent>
        <CustomBreadcrumbs
          heading="Editar miembro"
          links={[
            { name: 'Panel', href: paths.dashboard.root },
            { name: 'Miembros', href: paths.dashboard.level.member.root },
            { name: 'Editar' },
          ]}
          sx={{ mb: { xs: 3, md: 5 } }}
        />

        <Alert severity="warning">No tienes permisos para editar miembros.</Alert>
      </DashboardContent>
    );
  }

  return (
    <MemberEditLayout member={currentMember}>
      <MemberCreateEditForm currentMember={currentMember} />
    </MemberEditLayout>
  );
}
