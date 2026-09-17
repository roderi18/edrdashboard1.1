import { CONFIG } from 'src/global-config';

import { EverestDesignerView } from 'src/sections/everest/view';

// ----------------------------------------------------------------------

export const metadata = { title: `EXPLORA Designer | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return <EverestDesignerView />;
}
