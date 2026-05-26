import { CONFIG } from 'src/global-config';

import { AdminMaintenanceView } from 'src/sections/admin/view';

// ----------------------------------------------------------------------

export const metadata = { title: `Mantenimiento | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return <AdminMaintenanceView />;
}
