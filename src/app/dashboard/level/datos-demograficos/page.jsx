import { CONFIG } from 'src/global-config';

import { DatosDemograficosView } from 'src/sections/mapa-rd/datos-demograficos-view';

// ----------------------------------------------------------------------

export const metadata = { title: `Datos demográficos | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return <DatosDemograficosView />;
}
