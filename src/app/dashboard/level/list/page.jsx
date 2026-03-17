import { CONFIG } from 'src/global-config';

import { LevelListView } from 'src/sections/level/view';

// ----------------------------------------------------------------------

export const metadata = { title: `Level list | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return <LevelListView />;
}
