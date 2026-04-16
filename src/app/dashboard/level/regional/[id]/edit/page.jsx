import { CONFIG } from 'src/global-config';
import { RegionalEditView } from 'src/sections/regional/view';

// ----------------------------------------------------------------------

export const metadata = {
  title: `Regional edit | Dashboard - ${CONFIG.appName}`,
};

export default async function Page({ params }) {
  const { id } = await params;

  const res = await fetch(
    'https://systexploradores.somee.com/api/Regiones/GetAllRegiones',
    { cache: 'no-store' }
  );

  const json = await res.json();

  const data = json?.Data ?? [];
  console.log('ID 👉', id);
  console.log('DATA 👉', data);
  const regionalApi = data.find(
    (r) => Number(r.idRegion) === Number(id)
  );
  console.log('REGIONAL API 👉', regionalApi);
  const mappedRegional = regionalApi
    ? {
      id: regionalApi.idRegion,
      regionId: regionalApi.idRegion,
      name: regionalApi.nombre,
      countryId: regionalApi.idPais ?? '',
      regionalXSectionalCount: regionalApi.secciones?.length ?? 0,
      regionalXSectionalXDestCount: regionalApi.regionalXSectionalXDestCount || 0,
      regionalXSectionalMemberCount: 0,
    }
    : null;

  return <RegionalEditView regional={mappedRegional} />;
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
