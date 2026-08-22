import { getMembers } from 'src/services/member-service';
import { PRIMER_NUMERO_MIEMBRO } from 'src/catalogs/codigo-miembro';

// ----------------------------------------------------------------------
// Codigo de miembro: EDR-NNNNN, cinco digitos desde 10001.
//
//   EDR-10001   primer miembro registrado
//   EDR-10002   el siguiente, viva donde viva
//
// UNA sola cuenta para toda la organizacion. El codigo no dice donde esta la
// persona: es su identidad —su usuario de acceso y lo que sale en su carnet— y
// no cambia nunca.
//
// Antes llevaba pais y provincia (`DO-SD-10001`). Se quito por dos razones: la
// provincia cambia cuando alguien se muda, asi que el codigo decia una cosa
// mientras su destacamento decia otra; y cada provincia numeraba por separado,
// de modo que dos personas podian compartir el numero 10002 y, como al entrar
// solo se teclea el numero, una de las dos no podia entrar.
//
// Los codigos antiguos de nueve digitos (`EDR-111111201`) se ignoran a
// proposito. Antes se cogia el mayor numero existente y se le sumaba uno, de
// modo que aquellos nueve digitos se heredaban para siempre y el 10001 no
// llegaba nunca; al exigir cinco digitos exactos, los viejos quedan fuera de la
// cuenta y no contaminan a los nuevos. Tampoco pueden colisionar: tienen otra
// forma.
// ----------------------------------------------------------------------

export const PREFIJO_MIEMBRO = 'EDR';

// Se acepta cualquier prefijo al CONTAR —y la forma vieja con provincia— para
// que un codigo sin migrar no permita repartir dos veces el mismo numero.
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

