import { getDestsApi } from 'src/services/dest-service';
import { getMembers } from 'src/services/member-service';
import { getChurches } from 'src/services/church-service';
import { obtenerAbreviaturasProvincia } from 'src/services/provincias-service';
import {
  PRIMER_NUMERO_MIEMBRO,
  abreviaturaDeProvincia,
  PREFIJO_PROVINCIA_DESCONOCIDA,
} from 'src/catalogs/provincias-abreviaturas';

// ----------------------------------------------------------------------
// Codigo de miembro: ABREVIATURA-NNNNN, cinco digitos desde 10001, con la
// abreviatura de la provincia de la iglesia a la que pertenece su destacamento.
//
// La numeracion es POR PROVINCIA: cada prefijo lleva su propia cuenta, asi que
// SD-10001 y STG-10001 conviven sin chocar.
//
// Los codigos antiguos `DO-SD-111111xxx` se ignoran a proposito. Antes se cogia
// el mayor numero existente y se le sumaba uno, de modo que aquellos nueve
// digitos se heredaban para siempre y el 10001 no llegaba nunca; al exigir el
// formato de dos segmentos, los viejos quedan fuera de la cuenta y no
// contaminan a los nuevos. Tampoco pueden colisionar: tienen otra forma.
// ----------------------------------------------------------------------

const FORMATO_CODIGO = /^([A-Z]+)-(\d{5})$/;

// La API de Iglesias no tiene columna de provincia: la direccion se guarda como
// "Provincia, Municipio, Sector, Calle", asi que la provincia es el primer
// segmento. Si la direccion no sigue ese formato no hay provincia que sacar.
const provinciaDeDireccion = (direccion = '') => String(direccion).split(',')[0]?.trim() || '';

export async function resolverPrefijoProvincia(destId) {
  if (!destId) return PREFIJO_PROVINCIA_DESCONOCIDA;

  try {
    const [dests, iglesias, tabla] = await Promise.all([
      getDestsApi({ includePhotos: false }),
      getChurches(),
      obtenerAbreviaturasProvincia(),
    ]);

    const dest = (Array.isArray(dests) ? dests : []).find(
      (candidato) =>
        String(candidato?.id) === String(destId) ||
        String(candidato?.idDestacamento) === String(destId)
    );

    if (!dest) return PREFIJO_PROVINCIA_DESCONOCIDA;

    const idIglesia = dest.churchId ?? dest.idIglesia;
    const iglesia = (Array.isArray(iglesias) ? iglesias : []).find(
      (candidata) =>
        String(candidata?.id) === String(idIglesia) ||
        String(candidata?.idIglesia) === String(idIglesia)
    );

    const abreviatura = abreviaturaDeProvincia(
      provinciaDeDireccion(iglesia?.direccion || iglesia?.address),
      tabla
    );

    return abreviatura || PREFIJO_PROVINCIA_DESCONOCIDA;
  } catch {
    return PREFIJO_PROVINCIA_DESCONOCIDA;
  }
}

export async function generateMemberId({ destId = null } = {}) {
  const [prefijo, members] = await Promise.all([
    resolverPrefijoProvincia(destId),
    getMembers().catch(() => []),
  ]);

  const usados = (Array.isArray(members) ? members : [])
    .map((miembro) => String(miembro?.memberId || miembro?.codigoMiembro || '').toUpperCase())
    .map((codigo) => codigo.match(FORMATO_CODIGO))
    .filter((coincidencia) => coincidencia && coincidencia[1] === prefijo)
    .map((coincidencia) => Number(coincidencia[2]));

  const siguiente = usados.length ? Math.max(...usados) + 1 : PRIMER_NUMERO_MIEMBRO;

  return `${prefijo}-${String(siguiente).padStart(5, '0')}`;
}
