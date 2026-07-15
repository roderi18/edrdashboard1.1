'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

import { isUsuarioComunRole, canMemberManageMembers } from 'src/utils/member-access';

import { getResolvedMemberByIdentifier } from 'src/services/member-context-service';

import { SplashScreen } from 'src/components/loading-screen';

import { MemberEditLayout } from 'src/sections/member/layout/member-edit-layout';
import { MemberEditAwardsForm } from 'src/sections/member/awards/member-edit-awards-form';

import { useAuthContext } from 'src/auth/hooks';

export default function Page() {
  const { id } = useParams();
  const { user, loading } = useAuthContext();

  const [hydrated, setHydrated] = useState(false);
  const [currentMember, setCurrentMember] = useState(null);
  // El Usuario Común solo tiene lectura en Sistema de Ascenso; el resto de cargos
  // del destacamento con acceso pueden agregar.
  const canManage =
    (!user || user.role !== 'member' ? true : canMemberManageMembers(user)) &&
    !isUsuarioComunRole(user);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const member = await getResolvedMemberByIdentifier(id, {
          includeMetadata: false,
          includePhoto: true,
        });

        if (!cancelled) {
          setCurrentMember(member);
        }
      } finally {
        if (!cancelled) {
          setHydrated(true);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [id]);

  if (!hydrated) {
    return <SplashScreen title="Cargando premios" subtitle="Preparando el historial..." />;
  }

  if (loading) {
    return <SplashScreen title="Verificando acceso" subtitle="Casi listo..." />;
  }

  if (!currentMember) {
    return <div>Miembro no encontrado</div>;
  }

  return (
    <MemberEditLayout member={currentMember}>
      <MemberEditAwardsForm currentMember={currentMember} readOnly={!canManage} />
    </MemberEditLayout>
  );
}
