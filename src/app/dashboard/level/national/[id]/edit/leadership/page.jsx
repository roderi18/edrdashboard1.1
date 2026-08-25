import { CONFIG } from 'src/global-config';

import { NationalEditLayout } from 'src/sections/national/layout/national-edit-layout';
import { NationalLeadershipView } from 'src/sections/national/leadership/national-leadership-view';

// ----------------------------------------------------------------------

export const metadata = { title: `Directiva Nacional | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return (
    <NationalEditLayout>
      <NationalLeadershipView />
    </NationalEditLayout>
  );
}
