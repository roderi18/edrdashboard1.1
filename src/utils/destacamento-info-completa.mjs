// ----------------------------------------------------------------------
// ¿TIENE EL DESTACAMENTO SU INFORMACIÓN COMPLETA?
//
// Para cargar el Listado Nacional se crean destacamentos con lo que se sabe, y
// lo que falta se rellena con "Desconocido Desconocido" (persona) o "Desconocida"
// (iglesia). Eso deja crear el destacamento, pero no es información: sin esta
// regla un destacamento con todo "Desconocido" se veía igual de completo que uno
// con sus datos de verdad.
//
// Completo = coordinador, pastor, iglesia y dirección (provincia, municipio y
// sector; la calle es opcional). Un "Desconocido", un vacío o los textos de
// relleno de la API ("Pastor no especificado", "N/A"…) no cuentan.
// Lo usan la lista de destacamentos (el aviso sobre la foto) y el porcentaje
// "Dest. Info. Completa" que ven la Oficina Nacional y el Administrador Global.
// ----------------------------------------------------------------------

export const CAMPOS_INFO_COMPLETA = {
  coordinador: 'Coordinador',
  pastor: 'Pastor',
  iglesia: 'Iglesia',
  direccion: 'Dirección (provincia, municipio y sector)',
};

export const TEXTO_TIP_INFO_COMPLETA =
  'Un destacamento tiene la información completa cuando tiene coordinador, pastor, ' +
  'iglesia y dirección (provincia, municipio y sector). "Desconocido" o "Desconocida" no cuentan.';

const sinTildes = (valor) =>
  String(valor ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();

// Textos que la app o la API ponen cuando no hay dato.
const RELLENOS = ['', '-', 'n/a', 'na', 'sin informacion', 'no especificado', 'no especificada'];

/** ¿Es un dato de verdad, o un "Desconocido" / hueco / relleno? */
export const esDatoReal = (valor) => {
  const texto = sinTildes(valor);

  if (RELLENOS.includes(texto)) return false;
  if (texto.startsWith('desconocid')) return false;
  if (texto.endsWith('desconocido') || texto.endsWith('desconocida')) return false;
  if (texto.includes('no especificad')) return false;

  return true;
};

/**
 * La dirección de la iglesia se guarda "Provincia, Municipio, Sector, Calle"
 * (ver `mapDestToForm`). Completa = las tres primeras partes con dato real.
 */
export const direccionCompleta = (direccion) => {
  const partes = String(direccion ?? '')
    .split(',')
    .map((parte) => parte.trim());

  return partes.length >= 3 && partes.slice(0, 3).every(esDatoReal);
};

/** Lo que le falta, en el orden de `CAMPOS_INFO_COMPLETA`. Vacío = completo. */
export const faltantesDeDestacamento = ({ coordinador, pastor, iglesia, direccion } = {}) =>
  [
    !esDatoReal(coordinador) && 'coordinador',
    !esDatoReal(pastor) && 'pastor',
    !esDatoReal(iglesia) && 'iglesia',
    !direccionCompleta(direccion) && 'direccion',
  ].filter(Boolean);

export const textoDeFaltantes = (faltantes = []) =>
  faltantes.length
    ? `Información incompleta. Falta: ${faltantes
        .map((campo) => CAMPOS_INFO_COMPLETA[campo]?.split(' (')[0].toLowerCase() ?? campo)
        .join(', ')}.`
    : '';

/**
 * Porcentaje de destacamentos con la información completa. Los que aún no se
 * han evaluado (`infoFaltante` sin calcular) no cuentan ni a favor ni en contra.
 */
export const resumenInfoCompleta = (destacamentos = []) => {
  const evaluados = destacamentos.filter((dest) => Array.isArray(dest?.infoFaltante));
  const completos = evaluados.filter((dest) => dest.infoFaltante.length === 0).length;

  return {
    completos,
    total: evaluados.length,
    porcentaje: evaluados.length ? Math.round((completos / evaluados.length) * 100) : null,
  };
};
