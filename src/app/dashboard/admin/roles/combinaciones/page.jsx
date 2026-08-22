import { CONFIG } from 'src/global-config';

import { AdminRoleCombinationsView } from 'src/sections/admin/view';

// ----------------------------------------------------------------------

export const metadata = { title: `Combinación de roles | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return <AdminRoleCombinationsView />;
}
