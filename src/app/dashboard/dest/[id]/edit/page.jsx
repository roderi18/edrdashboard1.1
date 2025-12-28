import { CONFIG } from 'src/global-config';
import { _destList } from 'src/_mock/_dest';

import { DestEditView } from 'src/sections/dest/view';


// ----------------------------------------------------------------------

export const metadata = { title: `Dest edit | Dashboard - ${CONFIG.appName}` };

export default async function Page({ params }) {
  const { id } = await params;

  const currentDest = _destList.find((dest) => dest.id === id);

  return <DestEditView dest={currentDest} />;
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
  const data = CONFIG.isStaticExport ? _destList : _destList.slice(0, 1);

  return data.map((dest) => ({
    id: dest.id,
  }));
}
