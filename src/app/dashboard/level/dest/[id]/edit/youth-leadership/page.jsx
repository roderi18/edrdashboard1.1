import { CONFIG } from 'src/global-config';

import { DestEditLayout } from 'src/sections/dest/layout/dest-edit-layout';
import { DestYouthLeadershipView } from 'src/sections/dest/leadership/dest-youth-leadership-view';

// ----------------------------------------------------------------------

export const metadata = {
  title: `Directiva Líderes Juveniles | Dashboard - ${CONFIG.appName}`,
};

export default function Page() {
  return (
    <DestEditLayout>
      <DestYouthLeadershipView />
    </DestEditLayout>
  );
}
