import { CONFIG } from 'src/global-config';

import { AdminActualizacionesDestacamentosView } from 'src/sections/admin/view';

// ----------------------------------------------------------------------

export const metadata = { title: `Actualización de destacamentos | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return <AdminActualizacionesDestacamentosView />;
}
