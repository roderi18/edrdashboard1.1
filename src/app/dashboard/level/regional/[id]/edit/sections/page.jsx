import { CONFIG } from 'src/global-config';

import { RegionalSectionsView } from 'src/sections/regional/sections/regional-sections-view';

// ----------------------------------------------------------------------

export const metadata = {
  title: `Secciones de la región | Dashboard - ${CONFIG.appName}`,
};

export default function Page() {
  return <RegionalSectionsView />;
}
