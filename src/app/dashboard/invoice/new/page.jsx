import { CONFIG } from 'src/global-config';

import { InvoiceCreateView } from 'src/sections/invoice/view';

// ----------------------------------------------------------------------

export const metadata = { title: `Crear nuevo invoice | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return <InvoiceCreateView />;
}
