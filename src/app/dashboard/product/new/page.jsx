import { CONFIG } from 'src/global-config';

import { ProductCreateView } from 'src/sections/product/view';

// ----------------------------------------------------------------------

export const metadata = { title: `Crear nuevo producto | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return <ProductCreateView />;
}
