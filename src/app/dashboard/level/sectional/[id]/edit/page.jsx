import { CONFIG } from 'src/global-config';
import { SectionalEditView } from 'src/sections/sectional/view';
import { getSectionalById } from 'src/services/sectional-service';

export const metadata = { title: `Sectional edit | Dashboard - ${CONFIG.appName}` };

export default async function Page({ params }) {
  const { id } = await params;

  return <SectionalEditView sectionalId={id} />;
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
