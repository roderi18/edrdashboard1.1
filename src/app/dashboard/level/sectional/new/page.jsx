import { CONFIG } from 'src/global-config';

import { SectionalCreateView } from 'src/sections/sectional/view';

// ----------------------------------------------------------------------

export const metadata = { title: `Crear una nueva Sección | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return <SectionalCreateView />;
}
