import { CONFIG } from 'src/global-config';

import { UserAccountGeneralView } from 'src/sections/user-account/view';

// ----------------------------------------------------------------------

export const metadata = {
  title: `Mi cuenta | Dashboard - ${CONFIG.appName}`,
};

export default function Page() {
  return <UserAccountGeneralView />;
}
