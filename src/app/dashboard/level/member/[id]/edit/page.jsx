'use client';

import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';

import { canMemberManageMembers } from 'src/utils/member-access';

import {
  getResolvedMemberByIdentifier,
  getMemberDirectoryMetadata,
} from 'src/services/member-context-service';

import { SplashScreen } from 'src/components/loading-screen';
import { MemberEditLayout } from 'src/sections/member/layout/member-edit-layout';
import { MemberCreateEditForm } from 'src/sections/member/member-create-edit-form';

import { useAuthContext } from 'src/auth/hooks';

export default function Page() {
  const { id } = useParams();
  const { user, loading } = useAuthContext();

  const [hydrated, setHydrated] = useState(false);
  const [currentMember, setCurrentMember] = useState(null);
  const [availableDests, setAvailableDests] = useState([]);
  const canManage = !user || user.role !== 'member' ? true : canMemberManageMembers(user);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [metadata, member] = await Promise.all([
          getMemberDirectoryMetadata(),
          getResolvedMemberByIdentifier(id, { includeMetadata: true, includePhoto: true }),
        ]);

        if (cancelled) return;

        setAvailableDests(metadata?.dests || []);
        setCurrentMember(member);
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
    return <SplashScreen title="Cargando miembro" subtitle="Preparando su perfil..." />;
  }

  if (loading) {
    return <SplashScreen title="Verificando acceso" subtitle="Casi listo..." />;
  }

  if (!currentMember) {
    return <div>Miembro no encontrado</div>;
  }

  return (
    <MemberEditLayout member={currentMember}>
      <MemberCreateEditForm
        currentMember={currentMember}
        readOnly={!canManage}
        availableDests={availableDests}
      />
    </MemberEditLayout>
  );
}
