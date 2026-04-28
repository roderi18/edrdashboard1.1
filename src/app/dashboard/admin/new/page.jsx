import { CONFIG } from 'src/global-config';

import { AdminCreateView } from 'src/sections/admin/view';

// ----------------------------------------------------------------------

export const metadata = { title: `Crear administrador | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return <AdminCreateView />;
}
