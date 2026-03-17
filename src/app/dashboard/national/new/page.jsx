import { CONFIG } from 'src/global-config';

import { NationalCreateView } from 'src/sections/national/view';

// ----------------------------------------------------------------------

export const metadata = { title: `Crear un nuevo nacional | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return <NationalCreateView />;
}
