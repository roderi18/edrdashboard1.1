'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

import Alert from '@mui/material/Alert';

import { obtenerFotoPrincipal } from 'src/utils/firebase-photos';
import { canMemberManageMembers } from 'src/utils/member-access';

import { getMembers, mapApiMemberToUI } from 'src/services/member-service';

import { MemberEditAwardsForm } from 'src/sections/member/awards/member-edit-awards-form';

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
        (m) => String(m.idMiembros) === String(id) || String(m.codigoMiembro) === String(id)
      );

      if (!member) {
        setCurrentMember(null);
        setHydrated(true);
        return;
      }

      const mapped = mapApiMemberToUI(member);
      const memberPhoto = await obtenerFotoPrincipal({
        tipoEntidad: 'miembro',
        idEntidad: mapped?.id,
      });

      setCurrentMember({
        ...mapped,
        avatarUrl: memberPhoto?.urlFoto || mapped?.avatarUrl || null,
      });
      setHydrated(true);
    };

    load();
  }, [id]);

  if (!hydrated || loading) return null;

  if (!currentMember) {
    return <div>Miembro no encontrado</div>;
  }

  if (!canManage) {
    return <Alert severity="warning">No tienes permisos para editar miembros.</Alert>;
  }

  return <MemberEditAwardsForm currentMember={currentMember} />;
}
