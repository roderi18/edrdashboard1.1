import { CONFIG } from 'src/global-config';

import { SectionalDestsView } from 'src/sections/sectional/dests/sectional-dests-view';

// ----------------------------------------------------------------------

export const metadata = {
  title: `Destacamentos de la sección | Dashboard - ${CONFIG.appName}`,
};

export default function Page() {
  return <SectionalDestsView />;
}
