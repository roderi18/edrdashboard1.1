import { CONFIG } from 'src/global-config';

import { AdminSonidosView } from 'src/sections/admin/view';

// ----------------------------------------------------------------------

export const metadata = { title: `Sonidos | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return <AdminSonidosView />;
}
