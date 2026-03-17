import { CONFIG } from 'src/global-config';

import { UserCreateView } from 'src/sections/user/view';

// ----------------------------------------------------------------------

export const metadata = { title: `Crear nuevo user | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return <UserCreateView />;
}
