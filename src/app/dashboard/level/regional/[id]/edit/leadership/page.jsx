import { CONFIG } from 'src/global-config';

import { RegionalLeadershipView } from 'src/sections/regional/leadership/regional-leadership-view';

// ----------------------------------------------------------------------

export const metadata = { title: `Directiva regional | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return <RegionalLeadershipView />;
}
