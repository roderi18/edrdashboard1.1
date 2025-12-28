import { CONFIG } from 'src/global-config';

import { MemberProfileView } from 'src/sections/member/view';

// ----------------------------------------------------------------------

export const metadata = { title: `Member profile | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return <MemberProfileView />;
}
