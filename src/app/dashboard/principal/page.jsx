import { CONFIG } from 'src/global-config';

import { PrincipalHomeView } from 'src/sections/principal/view';

// ----------------------------------------------------------------------

export const metadata = { title: `Principal | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return <PrincipalHomeView />;
}
