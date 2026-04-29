'use client';

import Alert from '@mui/material/Alert';

import { paths } from 'src/routes/paths';

import { canMemberManageMembers } from 'src/utils/member-access';

import { DashboardContent } from 'src/layouts/dashboard';

import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

import { useAuthContext } from 'src/auth/hooks';

import { MemberCreateEditForm } from '../member-create-edit-form';

// ----------------------------------------------------------------------

export function MemberCreateView() {
  const { user, loading } = useAuthContext();

  if (loading) {
    return null;
  }

  const canManage =
    !user || !user.role || user.role !== 'member' ? true : canMemberManageMembers(user);

  if (!canManage) {
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

        <Alert severity="warning">No tienes permisos para crear miembros.</Alert>
      </DashboardContent>
    );
  }

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
    </DashboardContent>
  );
}
