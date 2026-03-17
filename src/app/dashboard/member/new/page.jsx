import { CONFIG } from 'src/global-config';

import { MemberCreateView } from 'src/sections/member/view';

// ----------------------------------------------------------------------

export const metadata = { title: `Crear un nuevo miembro | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return <MemberCreateView />;
}
