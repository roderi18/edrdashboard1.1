import { CONFIG } from 'src/global-config';

import { AdminNotificationsView } from 'src/sections/admin/view';

// ----------------------------------------------------------------------

export const metadata = { title: `Notificaciones | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return <AdminNotificationsView />;
}
