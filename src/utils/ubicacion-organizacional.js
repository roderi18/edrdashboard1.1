import { ROLES_POR_CODIGO } from 'src/auth/permissions/roles';

import { ROLES_DE_ADMINISTRACION } from './admin-role-label';

// ----------------------------------------------------------------------
// DONDE ESTA UNA PERSONA, Y QUE CARGOS EJERCE.
//
// Para PINTARLO, no para decidir nada: los guardas de alcance siguen siendo
// `member-access.js` y `org-level-access.js`. Aqui solo se traducen ids a nombres.
//
// La cadena es destacamento -> iglesia -> seccion -> region, y hay que recorrerla
// entera: la ficha de un miembro solo guarda su destacamento, y la seccion de un
// destacamento sale de su IGLESIA, no del propio destacamento. `member-access`
// tiene su propia version de esta cadena, pero es privada y devuelve conjuntos de
// ids para acotar listas; esto devuelve nombres para leer.
//
// Cada comparacion tolera varios nombres de campo porque los catalogos vienen de
// la API .NET y del mock con claves distintas (`idSeccion`/`sectionalId`/`id`).
// ----------------------------------------------------------------------

const texto = (valor) => String(valor ?? '').trim();

const mismoId = (a, b) => {
  const x = texto(a);

  return Boolean(x) && x === texto(b);
};

/** Todos los ids con los que se puede nombrar a un destacamento. */
const idsDelDestacamento = (dest = {}) => [dest?.id, dest?.idDestacamento, dest?.destId];

const idsDeLaIglesia = (entidad = {}) => [
  entidad?.churchId,
  entidad?.idIglesia,
  entidad?.iglesiaId,
  entidad?.id,
];

const idDeLaSeccion = (seccion = {}) =>
  texto(seccion?.idSeccion || seccion?.id || seccion?.sectionalId);

const idDeLaRegion = (region = {}) => texto(region?.idRegion || region?.id || region?.regionId);

const nombreDelDestacamento = (dest = {}) => {
  // El NUMERO es como se nombra un destacamento en toda la organizacion; el id
  // interno no le dice nada a nadie.
  const numero = texto(dest?.destNumber || dest?.numero);
  const nombre = texto(dest?.name || dest?.nombre);

  if (numero && nombre) return `${numero} · ${nombre}`;

  return numero || nombre || '';
};

/**
 * La region, la seccion y el destacamento a los que pertenece una persona.
 *
 * Devuelve los tres como texto ya listo para pintar, y cadena vacia en los que no
 * se puedan resolver: sin el catalogo cargado —o con un destacamento cuya iglesia
 * no esta en la lista— se ensena lo que se sepa en vez de inventar.
 */
export const describirUbicacionOrganizacional = (
  persona = {},
  { dests = [], churches = [], sectionals = [], regionals = [] } = {}
) => {
  const idDest = texto(
    persona?.idDestacamento || persona?.destId || persona?.destacamentoId || persona?.idDest
  );

  const dest = idDest
    ? dests.find((item) => idsDelDestacamento(item).some((valor) => mismoId(valor, idDest)))
    : null;

  // La seccion, por el camino corto si la ficha ya la trae y por la iglesia si no.
  let idSeccion = texto(
    persona?.sectionalId ||
      persona?.idSeccion ||
      persona?.seccionId ||
      dest?.sectionalId ||
      dest?.idSeccion ||
      dest?.seccionId
  );

  if (!idSeccion && dest) {
    const idsIglesiaDelDest = idsDeLaIglesia(dest).map(texto).filter(Boolean);
    const iglesia = churches.find((item) =>
      idsDeLaIglesia(item).some((valor) => idsIglesiaDelDest.includes(texto(valor)))
    );

    idSeccion = texto(iglesia?.idSeccion || iglesia?.sectionalId || iglesia?.seccionId);
  }

  const seccion = idSeccion
    ? sectionals.find((item) => mismoId(idDeLaSeccion(item), idSeccion))
    : null;

  const idRegion = texto(
    persona?.regionalId ||
      persona?.idRegion ||
      persona?.regionId ||
      seccion?.regionalId ||
      seccion?.idRegion ||
      seccion?.regionId
  );

  const region = idRegion ? regionals.find((item) => mismoId(idDeLaRegion(item), idRegion)) : null;

  return {
    destacamento: dest ? nombreDelDestacamento(dest) : '',
    seccion: texto(seccion?.sectionalName || seccion?.name || seccion?.nombre),
    region: texto(region?.regionalName || region?.name || region?.nombre),
  };
};

const NIVEL_LEGIBLE = {
  destacamento: 'Destacamento',
  seccional: 'Sección',
  seccion: 'Sección',
  regional: 'Región',
  region: 'Región',
  nacional: 'Nacional',
};

/**
 * TODOS los cargos organizacionales que ejerce una persona, para pintarlos.
 *
 * Se leen de `cargos` —la lista que guarda la sincronizacion de directivas—, no
 * del rol principal: con el rol principal se ve UNO, y quien coordina su
 * destacamento y ademas ocupa una casilla en su seccion ejerce los dos. Es la
 * misma razon por la que los guardas preguntan por `rolesQueEjerce`.
 *
 * Los cuatro cargos de administracion se quedan fuera a proposito: tienen su
 * propia columna, y repetirlos aqui hacia leer dos veces lo mismo.
 */
export const describirRolesOrganizacionales = (persona = {}) => {
  const cargos = Array.isArray(persona?.cargos) ? persona.cargos : [];
  const vistos = new Set();
  const resultado = [];

  cargos.forEach((cargo) => {
    const codigo = texto(cargo?.rol || cargo?.rolId || cargo?.codigo).toLowerCase();

    if (!codigo || vistos.has(codigo)) return;
    if (ROLES_DE_ADMINISTRACION.includes(codigo)) return;

    vistos.add(codigo);

    const nivel = texto(cargo?.nivel).toLowerCase();

    resultado.push({
      codigo,
      nombre: texto(cargo?.nombreCargo) || ROLES_POR_CODIGO[codigo]?.nombre || codigo,
      nivel: NIVEL_LEGIBLE[nivel] || '',
    });
  });

  return resultado;
};
