'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { DESTS, CHURCHES, REGIONALS, SECTIONALS, MEMBERS } from 'src/_mock/assets';
import { MemberEditLayout } from 'src/sections/member/layout/member-edit-layout';
import { MemberCreateEditForm } from 'src/sections/member/member-create-edit-form';

import { getAllMembers } from 'src/utils/member-storage';

export default function Page() {

  const { id } = useParams();

  const [hydrated, setHydrated] = useState(false);
  const [currentMember, setCurrentMember] = useState(null);

  useEffect(() => {
    const allMembers = getAllMembers(MEMBERS);
    const member = allMembers.find(
      (m) => m.memberId === id || m.id === id
    );

    setCurrentMember(member);
    setHydrated(true);
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