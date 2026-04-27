import { CONFIG } from 'src/global-config';

import { FirebaseSignUpView } from 'src/auth/view/firebase';

// ----------------------------------------------------------------------

export const metadata = { title: `Crear cuenta | Firebase - ${CONFIG.appName}` };

export default function Page() {
  return <FirebaseSignUpView />;
}
