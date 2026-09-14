import { CONFIG } from 'src/global-config';

import { AdminPaletteView } from 'src/sections/admin/view';

// ----------------------------------------------------------------------

export const metadata = { title: `Paleta | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return <AdminPaletteView />;
}
