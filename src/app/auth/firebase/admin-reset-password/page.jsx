import { CONFIG } from 'src/global-config';

import { FirebaseResetPasswordView } from 'src/auth/view/firebase';

// ----------------------------------------------------------------------

export const metadata = { title: `Restablecer contraseña administrador | Firebase - ${CONFIG.appName}` };

export default function Page() {
  return <FirebaseResetPasswordView mode="admin" />;
}

