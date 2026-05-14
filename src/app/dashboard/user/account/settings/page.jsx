import { CONFIG } from 'src/global-config';

import { UserAccountSettingsView } from 'src/sections/user-account/view';

// ----------------------------------------------------------------------

export const metadata = {
  title: `Configuracion LocalH | Dashboard - ${CONFIG.appName}`,
};

export default function Page() {
  return <UserAccountSettingsView />;
}
