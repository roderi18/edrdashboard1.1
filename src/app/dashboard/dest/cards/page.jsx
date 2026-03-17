import { CONFIG } from 'src/global-config';

import { DestCardsView } from 'src/sections/dest/view';

// ----------------------------------------------------------------------

export const metadata = { title: `Dest cards | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return <DestCardsView />;
}
