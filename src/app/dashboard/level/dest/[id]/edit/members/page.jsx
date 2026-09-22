import { CONFIG } from 'src/global-config';

import { DestMembersView } from 'src/sections/dest/members/dest-members-view';

// ----------------------------------------------------------------------

export const metadata = {
  title: `Miembros del destacamento | Dashboard - ${CONFIG.appName}`,
};

export default function Page() {
  return <DestMembersView />;
}
