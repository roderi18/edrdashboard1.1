import { CONFIG } from 'src/global-config';

import { LevelCardsView } from 'src/sections/level/view';

// ----------------------------------------------------------------------

export const metadata = { title: `Level cards | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return <LevelCardsView />;
}
