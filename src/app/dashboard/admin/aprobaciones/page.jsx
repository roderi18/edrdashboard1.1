import { CONFIG } from 'src/global-config';

import { AprobacionesView } from 'src/sections/aprobaciones/view';

export const metadata = { title: `Aprobaciones | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return <AprobacionesView />;
}
