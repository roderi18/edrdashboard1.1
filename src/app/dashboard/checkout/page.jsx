import { CONFIG } from 'src/global-config';

import { CheckoutView } from 'src/sections/checkout/view';

// ----------------------------------------------------------------------

export const metadata = { title: `Finalizar compra | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return <CheckoutView />;
}
