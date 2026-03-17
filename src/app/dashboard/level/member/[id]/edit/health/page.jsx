'use client';

import { MemberEditHealthForm } from 'src/sections/member/member-edit-health-form ';
import { MemberEditLayout } from 'src/sections/member/layout/member-edit-layout';
import { useParams } from 'next/navigation';
import { getStorageCollection } from 'src/utils/storage-service';
import { useState, useEffect } from 'react';
import { getMembers } from 'src/services/member-service';

const allMembers = getMembers();
export default function Page() {
    const { id } = useParams();

    const [hydrated, setHydrated] = useState(false);

    useEffect(() => {
        setHydrated(true);
    }, []);

    if (!hydrated) return null;

    const storedMembers = getStorageCollection('members') || [];

    const allMembers = getMembers();

    if (!currentMember) return null;


    return (
        <MemberEditLayout>
            <MemberEditHealthForm currentMember={currentMember} />
        </MemberEditLayout>
    );
}
