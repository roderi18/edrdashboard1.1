import { CONFIG } from 'src/global-config';

import { SectionalListView } from 'src/sections/sectional/view';


// ----------------------------------------------------------------------

export const metadata = { title: `Sectional list | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return <SectionalListView />;
}
