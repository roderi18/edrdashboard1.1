import { CONFIG } from 'src/global-config';

import { AttendanceQuickView } from 'src/sections/attendance/view';

// ----------------------------------------------------------------------

export const metadata = { title: `Asistencia | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return <AttendanceQuickView />;
}
