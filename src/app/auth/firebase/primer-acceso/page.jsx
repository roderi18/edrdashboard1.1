import { CONFIG } from 'src/global-config';

import { FirebasePrimerAccesoView } from 'src/auth/view/firebase';

// ----------------------------------------------------------------------

export const metadata = { title: `Crea tu contraseña | ${CONFIG.appName}` };

export default function Page() {
  return <FirebasePrimerAccesoView />;
}
