import { CONFIG } from 'src/global-config';

import { LevelProfileView } from 'src/sections/level/view';

// ----------------------------------------------------------------------

export const metadata = { title: `Level profile | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return <LevelProfileView />;
}
