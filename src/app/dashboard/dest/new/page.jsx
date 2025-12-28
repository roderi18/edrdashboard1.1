import { CONFIG } from 'src/global-config';

import { NationalCreateView } from 'src/sections/national/view';

// ----------------------------------------------------------------------

export const metadata = { title: `Create a new national | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return <NationalCreateView />;
}
