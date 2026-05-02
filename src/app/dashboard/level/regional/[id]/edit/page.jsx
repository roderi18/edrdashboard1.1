import { CONFIG } from 'src/global-config';

import { RegionalEditView } from 'src/sections/regional/view';

// ----------------------------------------------------------------------

export const metadata = {
  title: `Regional edit | Dashboard - ${CONFIG.appName}`,
};

export default async function Page({ params }) {
  const { id } = await params;

  return <RegionalEditView id={id} />;
}
