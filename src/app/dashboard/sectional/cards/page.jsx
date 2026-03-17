import { CONFIG } from 'src/global-config';

import { SectionalCardsView } from 'src/sections/sectional/view';

// ----------------------------------------------------------------------

export const metadata = { title: `Sectional cards | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return <SectionalCardsView />;
}
