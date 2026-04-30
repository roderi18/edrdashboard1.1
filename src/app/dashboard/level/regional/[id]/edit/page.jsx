import { CONFIG } from 'src/global-config';

import { RegionalEditView } from 'src/sections/regional/view';

// ----------------------------------------------------------------------

export const metadata = {
  title: `Regional edit | Dashboard - ${CONFIG.appName}`,
};

const fetchApiData = async (url) => {
  const res = await fetch(url, { cache: 'no-store' });
  const json = await res.json();

  return Array.isArray(json?.data)
    ? json.data
    : Array.isArray(json?.Data)
      ? json.Data
      : Array.isArray(json)
        ? json
        : [];
};

export default async function Page({ params }) {
  const { id } = await params;

  const [regionals, sectionals, churches, dests, members] = await Promise.all([
    fetchApiData('https://systexploradores.somee.com/api/Regiones/GetAllRegiones'),
    fetchApiData('https://systexploradores.somee.com/api/Secciones/GetAllSecciones'),
    fetchApiData('https://systexploradores.somee.com/api/Iglesias/GetAllIglesias'),
    fetchApiData('https://systexploradores.somee.com/api/Destacamentos/GetAllDestacamentos'),
    fetchApiData('https://systexploradores.somee.com/api/Miembros/GetAllMiembros'),
  ]);

  const regionalApi = regionals.find((regional) => Number(regional.idRegion) === Number(id));

  const seccionesDeRegion = sectionals.filter(
    (sectional) => Number(sectional.idRegion) === Number(id)
  );

  const iglesiasDeRegion = churches.filter((church) =>
    seccionesDeRegion.some(
      (sectional) => Number(sectional.idSeccion) === Number(church.idSeccion)
    )
  );

  const destacamentosDeRegion = dests.filter((dest) =>
    iglesiasDeRegion.some((church) => Number(church.idIglesia) === Number(dest.idIglesia))
  );

  const miembrosDeRegion = members.filter(
    (member) =>
      member.idDestacamento !== null &&
      destacamentosDeRegion.some(
        (dest) => Number(dest.idDestacamento) === Number(member.idDestacamento)
      )
  );

  const mappedRegional = regionalApi
    ? {
        id: regionalApi.idRegion,
        regionId: regionalApi.idRegion,
        name: regionalApi.nombre,
        countryId: regionalApi.idPais ?? '',
        regionalXSectionalCount: seccionesDeRegion.length,
        regionalXSectionalXDestCount: destacamentosDeRegion.length,
        regionalXSectionalMemberCount: miembrosDeRegion.length,
      }
    : null;

  return <RegionalEditView regional={mappedRegional} />;
}
