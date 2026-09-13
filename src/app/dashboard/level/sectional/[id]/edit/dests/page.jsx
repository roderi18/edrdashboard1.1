import { CONFIG } from 'src/global-config';

import { SectionalDestsView } from 'src/sections/sectional/dests/sectional-dests-view';
import { SectionalEditLayout } from 'src/sections/sectional/layout/sectional-edit-layout';

// ----------------------------------------------------------------------

export const metadata = {
  title: `Destacamentos de la sección | Dashboard - ${CONFIG.appName}`,
};

export default function Page() {
  return (
    <SectionalEditLayout tituloPrefijo="Destacamentos de la Sección">
      <SectionalDestsView />
    </SectionalEditLayout>
  );
}
