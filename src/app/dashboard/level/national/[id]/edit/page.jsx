import { CONFIG } from 'src/global-config';
import { _nationalList } from 'src/_mock/_national';

import { NationalEditView } from 'src/sections/national/view';
import { NationalEditLayout } from 'src/sections/national/layout/national-edit-layout';

// ----------------------------------------------------------------------

export const metadata = { title: `National edit | Dashboard - ${CONFIG.appName}` };

export default async function Page({ params }) {
  const { id } = await params;

  const currentNational = _nationalList.find((national) => national.id === id);

  return (
    <NationalEditLayout>
      <NationalEditView national={currentNational} />
    </NationalEditLayout>
  );
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

