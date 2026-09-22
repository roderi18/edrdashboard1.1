import { CONFIG } from 'src/global-config';

import { DestYouthLeadershipView } from 'src/sections/dest/leadership/dest-youth-leadership-view';

// ----------------------------------------------------------------------

export const metadata = {
  title: `Directiva Líderes Juveniles | Dashboard - ${CONFIG.appName}`,
};

export default function Page() {
  return <DestYouthLeadershipView />;
}
