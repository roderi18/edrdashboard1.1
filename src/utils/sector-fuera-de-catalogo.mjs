// ----------------------------------------------------------------------
// UN SECTOR QUE NO ESTÁ EN EL CATÁLOGO.
//
// El campo Sector de la dirección elige de `src/data/barrios.json`. Lo que
// llega de fuera —la landing de registro, o una dirección escrita a mano en la
// API— puede traer un sector que el catálogo no tiene con ese nombre exacto
// ("Los Mina", cuando el catálogo solo tiene "Los Mina Norte" y "Los Mina Sur").
// Se guardaba bien en la iglesia, pero la ficha lo buscaba por nombre, no lo
// encontraba y pintaba el campo VACÍO, como si no se hubiera recibido.
//
// Ahora un sector así viaja en el formulario como `texto:<nombre>`: el
// desplegable lo enseña como una opción más y, al guardar, vuelve tal cual.
// Sin dependencias, para probarlo con `node --test`.
// ----------------------------------------------------------------------

const PREFIJO = 'texto:';

/** El valor del formulario para un sector que no está en el catálogo. */
export const idDeSectorLibre = (nombre) => {
  const limpio = String(nombre ?? '').trim();

  return limpio ? `${PREFIJO}${limpio}` : '';
};

export const esSectorLibre = (sectorId) => String(sectorId ?? '').startsWith(PREFIJO);

/** El nombre del sector, sea del catálogo o libre. */
export const nombreDeSector = (sectorId, catalogo = []) => {
  const id = String(sectorId ?? '');

  if (!id) return '';
  if (esSectorLibre(id)) return id.slice(PREFIJO.length);

  return catalogo.find((s) => String(s.id) === id)?.nombre ?? '';
};

/** La opción que enseña el desplegable para un sector libre. */
export const opcionDeSectorLibre = (sectorId) =>
  esSectorLibre(sectorId) ? { id: String(sectorId), nombre: nombreDeSector(sectorId) } : null;

/**
 * Para comparar nombres de sector: sin mayúsculas, tildes, comas ni espacios de
 * más. "los americano" y "Los Americano" son el mismo sector.
 */
export const claveDeSector = (nombre) =>
  String(nombre ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[,\s]+/g, ' ')
    .trim()
    .toLowerCase();

/** Del nombre guardado al valor del formulario: el id del catálogo o, si no está, el libre. */
export const sectorIdDesdeNombre = (nombre, catalogo = []) => {
  const limpio = String(nombre ?? '').trim();

  if (!limpio) return '';

  const clave = claveDeSector(limpio);
  const delCatalogo =
    catalogo.find((s) => s.nombre === limpio) ||
    catalogo.find((s) => claveDeSector(s.nombre) === clave);

  return delCatalogo ? String(delCatalogo.id) : idDeSectorLibre(limpio);
};
