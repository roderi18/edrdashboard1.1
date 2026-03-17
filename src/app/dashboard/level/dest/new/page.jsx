import { CONFIG } from 'src/global-config';

import { DestCreateView } from 'src/sections/dest/view';

// ----------------------------------------------------------------------

export const metadata = { title: `Crear nuevo Destacamento | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return <DestCreateView />;
}
