import { getMembers } from 'src/services/member-service';
import { PRIMER_NUMERO_MIEMBRO } from 'src/catalogs/codigo-miembro';

export const PREFIJO_MIEMBRO = 'EDR';

// Al contar se acepta cualquier prefijo y la forma vieja con provincia, para que
// un codigo sin migrar no permita repartir dos veces el mismo numero.
const FORMATO_CODIGO = /^[A-Z]+(?:-[A-Z]+)?-(\d{5})$/;

/**
 * @param {object}   opciones
 * @param {string[]} opciones.codigosReservados  Codigos ya repartidos que todavia NO estan en
 *   la lista de miembros. La carga masiva crea varias personas seguidas y la lista viene de
 *   una cache de 30 segundos —y del API, que tarda en reflejar el alta—, asi que sin esto
 *   todas las filas del mismo archivo recibian el MISMO codigo.
 */
export async function generateMemberId({ codigosReservados = [] } = {}) {
  const members = await getMembers().catch(() => []);

  const usados = [
    ...(Array.isArray(members) ? members : []).map((miembro) =>
      String(miembro?.memberId || miembro?.codigoMiembro || '')
    ),
    ...(Array.isArray(codigosReservados) ? codigosReservados : []).map((codigo) =>
      String(codigo || '')
    ),
  ]
    .map((codigo) => codigo.trim().toUpperCase().match(FORMATO_CODIGO))
    .filter(Boolean)
    .map((coincidencia) => Number(coincidencia[1]));

  const siguiente = usados.length ? Math.max(...usados) + 1 : PRIMER_NUMERO_MIEMBRO;

  return `${PREFIJO_MIEMBRO}-${String(siguiente).padStart(5, '0')}`;
}

