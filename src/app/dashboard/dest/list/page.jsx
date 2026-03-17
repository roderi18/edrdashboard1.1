import { CONFIG } from 'src/global-config';

import { DestListView } from 'src/sections/dest/view';

// ----------------------------------------------------------------------

export const metadata = { title: `Dest list | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return <DestListView />;
}
