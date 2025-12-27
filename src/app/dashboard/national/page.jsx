import { CONFIG } from 'src/global-config';

import { NationalProfileView } from 'src/sections/national/view';

// ----------------------------------------------------------------------

export const metadata = { title: `National profile | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return <NationalProfileView />;
}
