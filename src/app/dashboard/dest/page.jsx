import { CONFIG } from 'src/global-config';

import { DestProfileView } from 'src/sections/national/view';

// ----------------------------------------------------------------------

export const metadata = { title: `Dest profile | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return <DestProfileView />;
}
