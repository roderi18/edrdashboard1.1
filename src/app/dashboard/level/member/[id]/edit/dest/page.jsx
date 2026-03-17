'use client';

import { DESTS, CHURCHES, REGIONALS, SECTIONALS, MEMBERS } from 'src/_mock/assets';
import { MemberEditLayout } from 'src/sections/member/layout/member-edit-layout';
import { MemberCreateEditForm } from 'src/sections/member/member-create-edit-form';

import { useParams } from 'next/navigation';

export default function Page() {
    const { id } = useParams();

    const storedMembers = getItems('members') || [];

    const allMembers = [...MEMBERS, ...storedMembers];

    const currentMember = allMembers.find((m) => m.id === id);

    // ⛔ seguridad
    if (!currentMember) return null;

    console.log(
        '🎯 posiciones en este DEST',
        MEMBERS
            .filter(m => m.destId === currentMember.destId)
            .map(m => ({ name: m.fullName, role: m.memberPosition }))
    );

    const dest = DESTS.find((d) => d.id === currentMember.destId);
    const church = CHURCHES.find((c) => c.id === dest?.churchId);
    const regional = REGIONALS.find((r) => r.id === currentMember.regionalId);
    const sectional = SECTIONALS.find((s) => s.id === currentMember.sectionalId);

    const coordinator =
        MEMBERS.find(
            (m) =>
                m.destId === currentMember.destId &&
                m.memberPosition === 'Coord. Destacamento'
        )?.fullName || 'No asignado';

    const assistantCoordinator =
        MEMBERS.find(
            (m) =>
                m.destId === currentMember.destId &&
                m.memberPosition === 'Coordinador As. Dest.'
        )?.fullName || 'No asignado ';

    console.log('👤 coordinator:', coordinator);
    console.log('👤 assistantCoordinator:', assistantCoordinator);


    const memberWithResolvedData = {

        ...currentMember,
        destName: dest?.name || '',
        church: church?.name || '',
        memberAddress: dest?.churchAddress || '',
        regionalName: regional?.name || '',
        sectionalName: sectional?.name || '',
        coordinatorName: coordinator,
        assistantCoordinatorName: assistantCoordinator,
    };
    console.log('📦 memberWithResolvedData:', memberWithResolvedData);


    return (
        <MemberEditLayout>
            <MemberCreateEditForm currentMember={memberWithResolvedData} />
        </MemberEditLayout>
    );
}
