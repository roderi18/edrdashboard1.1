import { CONFIG } from 'src/global-config';

import { AdminSystemHealthView } from 'src/sections/admin/view';

// ----------------------------------------------------------------------

export const metadata = { title: `Salud del sistema | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return <AdminSystemHealthView />;
}
