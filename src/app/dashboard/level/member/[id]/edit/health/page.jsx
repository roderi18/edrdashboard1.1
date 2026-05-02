'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

import { obtenerFotoPrincipal } from 'src/utils/firebase-photos';
import { canMemberManageMembers } from 'src/utils/member-access';

import { getMembers } from 'src/services/member-service';

import { MemberCard } from 'src/sections/member/member-card';
import { MemberEditHealthForm } from 'src/sections/member/member-edit-health-form ';

import { useAuthContext } from 'src/auth/hooks';

export default function Page() {
  const { id } = useParams();
  const { user, loading } = useAuthContext();

  const [hydrated, setHydrated] = useState(false);
  const [currentMember, setCurrentMember] = useState(null);
  const canManage = !user || user.role !== 'member' ? true : canMemberManageMembers(user);

  useEffect(() => {
    const load = async () => {
      const allMembers = await getMembers();
      const member = allMembers.find(
        (m) => String(m.id) === String(id) || String(m.memberId) === String(id)
      );

      if (!member) {
        setCurrentMember(null);
        setHydrated(true);
        return;
      }

      const memberPhoto = await obtenerFotoPrincipal({
        tipoEntidad: 'miembro',
        idEntidad: member?.id,
      });

      setCurrentMember({
        ...member,
        avatarUrl: memberPhoto?.urlFoto || member?.avatarUrl || null,
      });
      setHydrated(true);
    };

    load();
  }, [id]);

  if (!hydrated) return null;
  if (loading) return null;

  if (!currentMember) {
    return <div>Miembro no encontrado</div>;
  }

  if (!canManage) {
    return <MemberCard member={currentMember} canManage={false} />;
  }

  return <MemberEditHealthForm currentMember={currentMember} />;
}
