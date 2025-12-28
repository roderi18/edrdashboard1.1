import { CONFIG } from 'src/global-config';

import { MemberListView } from 'src/sections/member/view';

// ----------------------------------------------------------------------

export const metadata = { title: `Member list | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return <MemberListView />;
}
