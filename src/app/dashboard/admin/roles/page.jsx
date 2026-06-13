import { CONFIG } from 'src/global-config';

import { AdminRolesCatalogView } from 'src/sections/admin/view';

// ----------------------------------------------------------------------

export const metadata = { title: `Roles base | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return <AdminRolesCatalogView />;
}
