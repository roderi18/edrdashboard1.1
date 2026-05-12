import { CONFIG } from 'src/global-config';

import { PrincipalAppView } from 'src/sections/prinicipal/app/view';

// ----------------------------------------------------------------------

export const metadata = { title: `Principal | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return <PrincipalAppView />;
}
