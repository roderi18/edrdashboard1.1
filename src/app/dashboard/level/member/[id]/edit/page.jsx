'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { DESTS, CHURCHES, REGIONALS, SECTIONALS, MEMBERS } from 'src/_mock/assets';
import { MemberEditLayout } from 'src/sections/member/layout/member-edit-layout';
import { MemberCreateEditForm } from 'src/sections/member/member-create-edit-form';
import { mapApiMemberToUI } from 'src/services/member-service';
import { getAllMembers } from 'src/utils/member-storage';

export default function Page() {

  const { id } = useParams();

  const [hydrated, setHydrated] = useState(false);
  const [currentMember, setCurrentMember] = useState(null);

  useEffect(() => {
    const load = async () => {
      const res = await fetch('/api/members');
      console.log('RES:', res);

      const data = await res.json();
      console.log('DATA:', data);

      const allMembers = data?.Data || [];
      console.log('ALL MEMBERS:', allMembers);

      const member = allMembers.find(
        (m) =>
          String(m.idMiembros) === String(id) ||
          String(m.codigoMiembro) === String(id)
      );

      console.log('FOUND MEMBER:', member);

      setCurrentMember(mapApiMemberToUI(member));
      setHydrated(true);
    };

    load();
  }, [id]);
  if (!hydrated) return null;

  if (!currentMember) {
    return <div>Miembro no encontrado</div>;
  }

  return (
    <MemberEditLayout>
      <MemberCreateEditForm currentMember={currentMember} />
    </MemberEditLayout>
  );
}