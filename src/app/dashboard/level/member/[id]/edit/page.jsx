'use client';

import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';

import Alert from '@mui/material/Alert';

import { obtenerFotoPrincipal } from 'src/utils/firebase-photos';
import { canMemberManageMembers } from 'src/utils/member-access';

import { mapApiMemberToUI } from 'src/services/member-service';

import { MemberEditLayout } from 'src/sections/member/layout/member-edit-layout';
import { MemberCreateEditForm } from 'src/sections/member/member-create-edit-form';

import { useAuthContext } from 'src/auth/hooks';

export default function Page() {
  const { id } = useParams();
  const { user, loading } = useAuthContext();

  const [hydrated, setHydrated] = useState(false);
  const [currentMember, setCurrentMember] = useState(null);
  const canManage = !user || user.role !== 'member' ? true : canMemberManageMembers(user);

  useEffect(() => {
    const load = async () => {
      const res = await fetch('/api/members');

      const data = await res.json();

      const allMembers = data?.Data || [];
      const resDests = await fetch('/api/dest');
      const dataDests = await resDests.json();
      const dests = dataDests?.Data || [];

      const resChurches = await fetch('/api/churches');
      const dataChurches = await resChurches.json();
      const churches = dataChurches?.Data || [];

      const resSectionals = await fetch('/api/sectional');
      const dataSectionals = await resSectionals.json();
      const sectionals = dataSectionals?.Data || [];

      const resRegionals = await fetch('/api/regional');
      const dataRegionals = await resRegionals.json();
      const regionals = dataRegionals?.Data || [];

      const member = allMembers.find(
        (m) => String(m.idMiembros) === String(id) || String(m.codigoMiembro) === String(id)
      );

      const dest = dests.find((d) => Number(d.idDestacamento) === Number(member?.idDestacamento));

      const church = churches.find((c) => Number(c.idIglesia) === Number(dest?.idIglesia));

      const sectional = sectionals.find((s) => Number(s.idSeccion) === Number(church?.idSeccion));

      const regional = regionals.find((r) => Number(r.id) === Number(sectional?.idRegion));

      const mapped = mapApiMemberToUI(member);
      const memberPhoto = await obtenerFotoPrincipal({
        tipoEntidad: 'miembro',
        idEntidad: mapped?.id,
      });

      setCurrentMember({
        ...mapped,
        avatarUrl: memberPhoto?.urlFoto || mapped?.avatarUrl || null,
        sectionalName: sectional?.nombre || '-',
        regionalName: regional?.nombre || '-',
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
    return (
      <MemberEditLayout>
        <Alert severity="warning">No tienes permisos para editar miembros.</Alert>
      </MemberEditLayout>
    );
  }

  return (
    <MemberEditLayout>
      <MemberCreateEditForm currentMember={currentMember} />
    </MemberEditLayout>
  );
}
