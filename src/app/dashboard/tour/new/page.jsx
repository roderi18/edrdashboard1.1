import { CONFIG } from 'src/global-config';

import { TourCreateView } from 'src/sections/tour/view';

// ----------------------------------------------------------------------

export const metadata = { title: `Crear nuevo tour | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return <TourCreateView />;
}
