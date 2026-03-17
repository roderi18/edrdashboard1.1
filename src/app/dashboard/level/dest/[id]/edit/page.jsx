import { CONFIG } from 'src/global-config';
import { getDests } from 'src/services/dest-service';

import { DestEditView } from 'src/sections/dest/view';
import { DestEditLayout } from 'src/sections/dest/layout/dest-edit-layout';

// ----------------------------------------------------------------------

export const metadata = { title: `Dest edit | Dashboard - ${CONFIG.appName}` };

export default async function Page({ params }) {
  const { id } = await params;
  console.log('DEST ID PARAM:', id);
  return (
    <DestEditLayout>
      <DestEditView id={id} />
    </DestEditLayout>
  );
}