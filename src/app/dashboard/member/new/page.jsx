import { CONFIG } from 'src/global-config';

import { MemberCreateView } from 'src/sections/member/view';

// ----------------------------------------------------------------------

export const metadata = { title: `Create a new member | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return <MemberCreateView />;
}
