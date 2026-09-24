'use client';

import Alert from '@mui/material/Alert';

import { paths } from 'src/routes/paths';

import { isFullOrgManager } from 'src/utils/org-level-access';
import { canMemberManageMembers, puedeEditarSuPropiaFicha } from 'src/utils/member-access';

import { DashboardContent } from 'src/layouts/dashboard';

import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

import { MemberEditLayout } from 'src/sections/member/layout/member-edit-layout';
import { OrganizationalTabSkeleton } from 'src/sections/common/organizational-tab-skeleton';

import { useAuthContext } from 'src/auth/hooks';
import { PERMISOS, puedeModificar } from 'src/auth/permissions';

import { MemberCreateEditForm } from '../member-create-edit-form';

// ----------------------------------------------------------------------

export function MemberEditView({ member: currentMember }) {
  const { user, loading } = useAuthContext();

  // Mientras se resuelve la sesión, el esqueleto de la ficha: con `null` la
  // pestaña se quedaba en blanco.
  if (loading) {
    return <OrganizationalTabSkeleton />;
  }

  const isMemberSession = user?.role === 'member';
  // Admin de seccion/region: pueden VER el miembro pero no editarlo (su rol no
  // incluye permiso de edicion) -> formulario en solo lectura.
  const canEditMembers = isMemberSession
    ? canMemberManageMembers(user)
    : isFullOrgManager(user) || puedeModificar(user, PERMISOS.MIEMBROS_EDITAR);
  const esFichaPropia = puedeEditarSuPropiaFicha(user, currentMember);

  // Los miembros sin permiso de gestion pueden entrar a su propia ficha para
  // cambiar la foto, aunque no tengan cargo. El resto de la ficha conserva el
  // control normal de permisos.
  if (isMemberSession && !canEditMembers && !esFichaPropia) {
    return (
      <DashboardContent>
        <CustomBreadcrumbs
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
      <MemberCreateEditForm
        currentMember={currentMember}
        readOnly={!canEditMembers && !esFichaPropia}
      />
    </MemberEditLayout>
  );
}
