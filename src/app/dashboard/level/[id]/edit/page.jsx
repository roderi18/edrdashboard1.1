import { CONFIG } from 'src/global-config';
import { _levelList } from 'src/_mock/_level';

import { LevelEditView } from 'src/sections/level/view';

// ----------------------------------------------------------------------

export const metadata = { title: `Level edit | Dashboard - ${CONFIG.appName}` };

export default async function Page({ params }) {
  const { id } = await params;

  const currentLevel = _levelList.find((level) => level.id === id);

  return <LevelEditView level={currentLevel} />;
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
  const data = CONFIG.isStaticExport ? _levelList : _levelList.slice(0, 1);

  return data.map((level) => ({
    id: level.id,
  }));
}
