import { CONFIG } from 'src/global-config';

import { LevelCreateView } from 'src/sections/level/view';

// ----------------------------------------------------------------------

export const metadata = { title: `Create a new level | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return <LevelCreateView />;
}
