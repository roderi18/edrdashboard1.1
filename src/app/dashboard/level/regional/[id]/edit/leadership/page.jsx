import { CONFIG } from 'src/global-config';

import { RegionalEditLayout } from 'src/sections/regional/layout/regional-edit-layout';
import { RegionalLeadershipView } from 'src/sections/regional/leadership/regional-leadership-view';

// ----------------------------------------------------------------------

export const metadata = { title: `Directiva regional | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return (
    <RegionalEditLayout>
      <RegionalLeadershipView />
    </RegionalEditLayout>
  );
}
