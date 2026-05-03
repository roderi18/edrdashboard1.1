import { CONFIG } from 'src/global-config';

import { OverviewEcommerceView } from 'src/sections/overview/e-commerce/view';

// ----------------------------------------------------------------------

export const metadata = { title: `Comercio electrónico | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return <OverviewEcommerceView />;
}
