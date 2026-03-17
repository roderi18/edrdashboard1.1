import { CONFIG } from 'src/global-config';

import { RegionalProfileView } from 'src/sections/national/view';

// ----------------------------------------------------------------------

export const metadata = { title: `Regional profile | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return <RegionalProfileView />;
}
