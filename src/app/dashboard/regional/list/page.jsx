import { CONFIG } from 'src/global-config';

import { RegionalListView } from 'src/sections/regional/view';

// ----------------------------------------------------------------------

export const metadata = { title: `Regional list | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return <RegionalListView />;
}
