'use client';

import Alert from '@mui/material/Alert';

import { paths } from 'src/routes/paths';
import { useSearchParams } from 'src/routes/hooks';

import { isFullOrgManager } from 'src/utils/org-level-access';
import { canMemberManageMembers } from 'src/utils/member-access';

import { DashboardContent } from 'src/layouts/dashboard';

import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

import { OrganizationalTabSkeleton } from 'src/sections/common/organizational-tab-skeleton';

import { useAuthContext } from 'src/auth/hooks';
import { can, PERMISOS } from 'src/auth/permissions';

import { MemberCreateEditForm } from '../member-create-edit-form';

// ----------------------------------------------------------------------

export function MemberCreateView() {
  const { user, loading } = useAuthContext();
  const searchParams = useSearchParams();
  // Se llega aqui desde la ficha de un destacamento con "Agregar nuevo miembro":
  // el destacamento viene en la direccion para no obligar a buscarlo a mano.
  const destIdInicial = searchParams.get('destId') || '';

  // Mientras se resuelve la sesión, el esqueleto de la ficha: con `null` la
  // pestaña se quedaba en blanco.
  if (loading) {
    return <OrganizationalTabSkeleton />;
  }

  // Crear miembros exige permiso real: los admin de seccion/region no lo tienen.
  const canManage =
    user?.role === 'member'
      ? canMemberManageMembers(user)
      : isFullOrgManager(user) || can(user, PERMISOS.MIEMBROS_CREAR);

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

      <MemberCreateEditForm destIdInicial={destIdInicial} />
    </DashboardContent>
  );
}
