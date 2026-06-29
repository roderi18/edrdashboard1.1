import { CONFIG } from 'src/global-config';

import { AdminPermissionsCatalogView } from 'src/sections/admin/view';

// ----------------------------------------------------------------------

export const metadata = { title: `Catalogo de permisos | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return <AdminPermissionsCatalogView />;
}
