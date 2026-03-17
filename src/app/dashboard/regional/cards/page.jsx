import { CONFIG } from 'src/global-config';

import { RegionalCardsView } from 'src/sections/regional/view';

// ----------------------------------------------------------------------

export const metadata = { title: `Regional cards | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return <RegionalCardsView />;
}
