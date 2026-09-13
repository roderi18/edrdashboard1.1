import { CONFIG } from 'src/global-config';

import { RegionalEditLayout } from 'src/sections/regional/layout/regional-edit-layout';
import { RegionalSectionsView } from 'src/sections/regional/sections/regional-sections-view';

// ----------------------------------------------------------------------

export const metadata = {
  title: `Secciones de la región | Dashboard - ${CONFIG.appName}`,
};

export default function Page() {
  return (
    <RegionalEditLayout tituloPrefijo="Secciones de la Región">
      <RegionalSectionsView />
    </RegionalEditLayout>
  );
}
