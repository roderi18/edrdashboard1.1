import { CONFIG } from 'src/global-config';

import { NationalLeadershipView } from 'src/sections/national/leadership/national-leadership-view';

// ----------------------------------------------------------------------

export const metadata = { title: `Directiva Nacional | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return <NationalLeadershipView />;
}
