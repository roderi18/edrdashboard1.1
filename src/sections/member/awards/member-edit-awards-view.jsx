'use client';

import { MemberEditLayout } from 'src/sections/member/layout/member-edit-layout';
import { MemberEditAwardsForm } from 'src/sections/member/awards/member-edit-awards-form';

// ----------------------------------------------------------------------

export function MemberEditAwardsView({ member }) {
    return (
        <MemberEditLayout member={member}>
            <MemberEditAwardsForm currentMember={member} />
        </MemberEditLayout>
    );
}
