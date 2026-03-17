import { CONFIG } from 'src/global-config';

import { NationalCardsView } from 'src/sections/national/view';

// ----------------------------------------------------------------------

export const metadata = { title: `National cards | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return <NationalCardsView />;
}
