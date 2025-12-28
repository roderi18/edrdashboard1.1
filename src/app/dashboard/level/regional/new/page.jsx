import { CONFIG } from 'src/global-config';

import { RegionalCreateView } from 'src/sections/regional/view';

// ----------------------------------------------------------------------

export const metadata = { title: `Crear un nuevo regional | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return <RegionalCreateView />;
}
