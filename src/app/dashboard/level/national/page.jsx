import { CONFIG } from 'src/global-config';

import { NationalListView } from 'src/sections/national/view';

// ----------------------------------------------------------------------

export const metadata = { title: `National list | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return <NationalListView />;
}
