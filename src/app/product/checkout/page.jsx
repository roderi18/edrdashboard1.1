import { redirect } from 'next/navigation';

import { paths } from 'src/routes/paths';

import { CONFIG } from 'src/global-config';

// ----------------------------------------------------------------------

export const metadata = { title: `Finalizar compra - ${CONFIG.appName}` };

export default function Page() {
  redirect(paths.dashboard.checkout);
}
