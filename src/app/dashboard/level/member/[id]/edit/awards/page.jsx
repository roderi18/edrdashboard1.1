'use client';

import { useParams } from 'next/navigation';

import { MemberEditLayout } from 'src/sections/member/layout/member-edit-layout';
import { MemberEditAwardsForm } from 'src/sections/member/awards/member-edit-awards-form';
import { getMembers } from 'src/services/member-service';

import { getStorageCollection } from 'src/utils/storage-service';

export default function Page() {

    const { id } = useParams();

    const storedMembers = getStorageCollection('members') || [];

    const allMembers = getMembers();

    const member = allMembers.find((m) => m.id === id);

    if (!member) return null;

    return (
        <MemberEditLayout member={member}>
            <MemberEditAwardsForm currentMember={member} />
        </MemberEditLayout>
    );
}