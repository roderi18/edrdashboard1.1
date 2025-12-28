import { CONFIG } from 'src/global-config';

import { MemberCardsView } from 'src/sections/member/view';

// ----------------------------------------------------------------------

export const metadata = { title: `Member cards | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return <MemberCardsView />;
}
