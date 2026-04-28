import { CONFIG } from 'src/global-config';

import { FirebaseSignInView } from 'src/auth/view/firebase';

// ----------------------------------------------------------------------

export const metadata = { title: `Iniciar sesión administrador | Firebase - ${CONFIG.appName}` };

export default function Page() {
  return <FirebaseSignInView mode="admin" />;
}

