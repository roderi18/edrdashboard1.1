import { CONFIG } from 'src/global-config';

import { DestEditLayout } from 'src/sections/dest/layout/dest-edit-layout';
import { DestMembersView } from 'src/sections/dest/members/dest-members-view';

// ----------------------------------------------------------------------

export const metadata = {
  title: `Miembros del destacamento | Dashboard - ${CONFIG.appName}`,
};

export default function Page() {
  return (
    <DestEditLayout tituloPrefijo="Miembros del Destacamento">
      <DestMembersView />
    </DestEditLayout>
  );
}
