// 'use client';

// import { AwardsManagerView } from 'src/sections/member/awards/view/awards-manager-view';

// export default function MemberEditAwardsPage() {
//     return <AwardsManagerView />;
// }

'use client';

import { useParams } from 'next/navigation';
import { AwardsManagerView } from 'src/sections/member/awards/view/awards-manager-view';

export default function MemberEditAwardsPage() {
    const params = useParams();
    const memberId = params?.id; // "member-17"

    return <AwardsManagerView memberId={memberId} />;
}
