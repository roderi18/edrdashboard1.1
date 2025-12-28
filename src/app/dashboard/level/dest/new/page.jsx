import { CONFIG } from 'src/global-config';

import { DestCreateView } from 'src/sections/dest/view';

// ----------------------------------------------------------------------

export const metadata = { title: `Create a new dest | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return <DestCreateView />;
}
