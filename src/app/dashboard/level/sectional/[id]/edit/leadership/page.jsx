import { CONFIG } from 'src/global-config';

import { SectionalLeadershipView } from 'src/sections/sectional/leadership/sectional-leadership-view';

// ----------------------------------------------------------------------

export const metadata = { title: `Directiva seccional | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return <SectionalLeadershipView />;
}
