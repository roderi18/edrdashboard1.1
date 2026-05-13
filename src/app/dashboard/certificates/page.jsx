import { CONFIG } from 'src/global-config';

import { CertificatesAutomationView } from 'src/sections/certificates/view';

// ----------------------------------------------------------------------

export const metadata = { title: `Certificados | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return <CertificatesAutomationView />;
}
