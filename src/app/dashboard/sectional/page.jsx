import { CONFIG } from 'src/global-config';

import { SectionalProfileView } from 'src/sections/sectional/view';

// ----------------------------------------------------------------------

export const metadata = { title: `Sectional profile | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return <SectionalProfileView />;
}
