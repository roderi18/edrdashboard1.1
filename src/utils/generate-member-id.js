import { getDestsApi } from 'src/services/dest-service';
import { getMembers } from 'src/services/member-service';
import { getChurches } from 'src/services/church-service';
import { getRegionals } from 'src/services/regional-service';
import { getSectionals } from 'src/services/sectional-service';
import {
  obtenerAbreviaturasPais,
  obtenerAbreviaturasProvincia,
} from 'src/services/provincias-service';
import {
  PRIMER_NUMERO_MIEMBRO,
  abreviaturaDeProvincia,
  PREFIJO_PAIS_POR_DEFECTO,
  PREFIJO_PROVINCIA_DESCONOCIDA,
} from 'src/catalogs/provincias-abreviaturas';

// ----------------------------------------------------------------------
// Codigo de miembro: PAIS-PROVINCIA-NNNNN, cinco digitos desde 10001.
//
//   RD-SD-10001   Santo Domingo, Republica Dominicana
//   RD-STG-10001  Santiago, misma cuenta aparte
//
// El pais va delante porque la organizacion se abrira a otros paises y entonces
// RD-SD-10001 y PA-SD-10001 tienen que poder convivir. La numeracion es POR
// PAIS Y PROVINCIA: cada combinacion lleva su propia cuenta.
//
// Los codigos antiguos `DO-SD-111111xxx` se ignoran a proposito. Antes se cogia
// el mayor numero existente y se le sumaba uno, de modo que aquellos nueve
// digitos se heredaban para siempre y el 10001 no llegaba nunca; al exigir cinco
// digitos exactos, los viejos quedan fuera de la cuenta y no contaminan a los
// nuevos. Tampoco pueden colisionar: tienen otra forma.
// ----------------------------------------------------------------------

const FORMATO_CODIGO = /^([A-Z]+)-([A-Z]+)-(\d{5})$/;

// La API de Iglesias no tiene columna de provincia: la direccion se guarda como
// "Provincia, Municipio, Sector, Calle", asi que la provincia es el primer
// segmento. Si la direccion no sigue ese formato no hay provincia que sacar.
const provinciaDeDireccion = (direccion = '') => String(direccion).split(',')[0]?.trim() || '';

const mismoId = (izquierda, derecha) => {
  const a = String(izquierda ?? '').trim();
  const b = String(derecha ?? '').trim();

  return Boolean(a && b && a === b);
};

// Del destacamento al pais y la provincia: destacamento → iglesia → seccion →
// region → pais. La provincia sale de la direccion de la iglesia; el pais, de la
// region a la que cuelga.
export async function resolverPrefijosDeDestacamento(destId) {
  const porDefecto = {
    pais: PREFIJO_PAIS_POR_DEFECTO,
    provincia: PREFIJO_PROVINCIA_DESCONOCIDA,
  };

  if (!destId) return porDefecto;

  try {
    const [dests, iglesias, secciones, regiones, tablaProvincias, tablaPaises] = await Promise.all([
      getDestsApi({ includePhotos: false }),
      getChurches(),
      getSectionals({ includePhotos: false }),
      getRegionals({ includePhotos: false }),
      obtenerAbreviaturasProvincia(),
      obtenerAbreviaturasPais(),
    ]);

    const dest = (Array.isArray(dests) ? dests : []).find(
      (candidato) => mismoId(candidato?.id, destId) || mismoId(candidato?.idDestacamento, destId)
    );

    if (!dest) return porDefecto;

    const idIglesia = dest.churchId ?? dest.idIglesia;
    const iglesia = (Array.isArray(iglesias) ? iglesias : []).find(
      (candidata) => mismoId(candidata?.id, idIglesia) || mismoId(candidata?.idIglesia, idIglesia)
    );

    const provincia =
      abreviaturaDeProvincia(
        provinciaDeDireccion(iglesia?.direccion || iglesia?.address),
        tablaProvincias
      ) || PREFIJO_PROVINCIA_DESCONOCIDA;

    const idSeccion = iglesia?.idSeccion ?? iglesia?.sectionId ?? iglesia?.sectionalId;
    const seccion = (Array.isArray(secciones) ? secciones : []).find(
      (candidata) => mismoId(candidata?.idSeccion, idSeccion) || mismoId(candidata?.id, idSeccion)
    );

    const idRegion = seccion?.regionalId ?? seccion?.idRegion;
    const region = (Array.isArray(regiones) ? regiones : []).find(
      (candidata) => mismoId(candidata?.id, idRegion) || mismoId(candidata?.idRegion, idRegion)
    );

    const idPais = region?.idPais ?? region?.countryId;
    const pais = tablaPaises[String(idPais)] || PREFIJO_PAIS_POR_DEFECTO;

    return { pais, provincia };
  } catch {
    return porDefecto;
  }
}

export async function generateMemberId({ destId = null } = {}) {
  const [{ pais, provincia }, members] = await Promise.all([
    resolverPrefijosDeDestacamento(destId),
    getMembers().catch(() => []),
  ]);

  const usados = (Array.isArray(members) ? members : [])
    .map((miembro) => String(miembro?.memberId || miembro?.codigoMiembro || '').toUpperCase())
    .map((codigo) => codigo.match(FORMATO_CODIGO))
    .filter(
      (coincidencia) =>
        coincidencia && coincidencia[1] === pais && coincidencia[2] === provincia
    )
    .map((coincidencia) => Number(coincidencia[3]));

  const siguiente = usados.length ? Math.max(...usados) + 1 : PRIMER_NUMERO_MIEMBRO;

  return `${pais}-${provincia}-${String(siguiente).padStart(5, '0')}`;
}
