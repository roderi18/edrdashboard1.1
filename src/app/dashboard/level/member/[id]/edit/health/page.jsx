'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

import { canMemberManageMembers } from 'src/utils/member-access';

import { getResolvedMemberByIdentifier } from 'src/services/member-context-service';

import { SplashScreen } from 'src/components/loading-screen';
import { MemberEditHealthForm } from 'src/sections/member/member-edit-health-form ';

import { useAuthContext } from 'src/auth/hooks';

export default function Page() {
  const { id } = useParams();
  const { user, loading } = useAuthContext();

  const [hydrated, setHydrated] = useState(false);
  const [currentMember, setCurrentMember] = useState(null);
  const canManage = !user || user.role !== 'member' ? true : canMemberManageMembers(user);

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
    return <SplashScreen title="Cargando salud" subtitle="Preparando el expediente..." />;
  }

  if (loading) {
    return <SplashScreen title="Verificando acceso" subtitle="Casi listo..." />;
  }

  if (!currentMember) {
    return <div>Miembro no encontrado</div>;
  }

  return <MemberEditHealthForm currentMember={currentMember} readOnly={!canManage} />;
}
