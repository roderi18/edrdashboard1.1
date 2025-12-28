import { CONFIG } from 'src/global-config';
import { _sectionalList } from 'src/_mock/_sectional';

import { SectionalEditView } from 'src/sections/sectional/view';


// ----------------------------------------------------------------------

export const metadata = { title: `Sectional edit | Dashboard - ${CONFIG.appName}` };

export default async function Page({ params }) {
  const { id } = await params;

  const currentSectional = _sectionalList.find((sectional) => sectional.id === id);

  return <SectionalEditView sectional={currentSectional} />;
}

// ----------------------------------------------------------------------

/**
 * Static Exports in Next.js
 *
 * 1. Set `isStaticExport = true` in `next.config.{mjs|ts}`.
 * 2. This allows `generateStaticParams()` to pre-render dynamic routes at build time.
 *
 * For more details, see:
 * https://nextjs.org/docs/app/building-your-application/deploying/static-exports
 *
 * NOTE: Remove all "generateStaticParams()" functions if not using static exports.
 */
export async function generateStaticParams() {
  const data = CONFIG.isStaticExport ? _sectionalList : _sectionalList.slice(0, 1);

  return data.map((sectional) => ({
    id: sectional.id,
  }));
}
