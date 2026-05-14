import { CONFIG } from 'src/global-config';

import { AdminCoverPhotosView } from 'src/sections/admin/view';

// ----------------------------------------------------------------------

export const metadata = { title: `Fotos de portadas | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return <AdminCoverPhotosView />;
}
