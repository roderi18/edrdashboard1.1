import { CONFIG } from 'src/global-config';

import { DominicanRepublicMapDemo } from 'src/sections/mapa-rd/dominican-republic-map-demo';

export const metadata = {
  title: `Mapa interactivo de República Dominicana | ${CONFIG.appName}`,
};

export default function Page() {
  return <DominicanRepublicMapDemo />;
}
