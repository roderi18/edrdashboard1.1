// ----------------------------------------------------------------------
// LOS DESTACAMENTOS EN EL MAPA: su provincia y su región.
//
// Como el mapa de la landing de registro, pero con el padrón entero:
// - La provincia sale de la dirección del destacamento ("Provincia, Municipio,
//   Sector, Calle") y, si no la tiene, de la de su iglesia.
// - La región es la de verdad (destacamento → iglesia → sección → región), no la
//   del color de la provincia: un destacamento de una provincia del Norte puede
//   pertenecer a la Región Central.
// "Provisional" no es un destacamento: es donde el padrón deja a quien aún no
// tiene uno, y no se cuenta.
// ----------------------------------------------------------------------

const clave = (valor) =>
  String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

// El padrón escribe algunas provincias distinto que el mapa.
const ALIAS = {
  baoruco: 'bahoruco',
  'santo domingo de guzman': 'distrito nacional',
  'monsenor nouel (bonao)': 'monsenor nouel',
};

const provinciaDeDireccion = (direccion) => {
  const primera = String(direccion ?? '').split(',')[0];
  const k = clave(primera);
  return ALIAS[k] ?? k;
};

/**
 * [{ id, nombre, numero, provincia, region }] con `provincia` = nombre tal como
 * lo usa el mapa (o null) y `region` = nombre de la región (o null).
 */
export function destacamentosDelMapa({
  destacamentos = [],
  iglesias = [],
  secciones = [],
  regiones = [],
  provinciasDelMapa = [],
}) {
  const provinciaPorClave = new Map(provinciasDelMapa.map((nombre) => [clave(nombre), nombre]));
  const iglesiaPorId = new Map(iglesias.map((i) => [String(i.idIglesia), i]));
  const seccionPorId = new Map(secciones.map((s) => [String(s.idSeccion), s]));
  const regionPorId = new Map(regiones.map((r) => [String(r.idRegion), r]));

  return destacamentos
    .filter((d) => clave(d.nombre) !== 'provisional')
    .map((d) => {
      const iglesia = iglesiaPorId.get(String(d.idIglesia));
      const seccion = seccionPorId.get(String(iglesia?.idSeccion));
      const region = regionPorId.get(String(seccion?.idRegion));
      const provincia =
        provinciaPorClave.get(provinciaDeDireccion(d.direccion)) ??
        provinciaPorClave.get(provinciaDeDireccion(iglesia?.direccion)) ??
        null;
      return {
        id: String(d.idDestacamento),
        nombre: String(d.nombre ?? '').trim(),
        numero: String(d.numero ?? '').trim(),
        provincia,
        region: region?.nombre ?? null,
      };
    });
}

/** Map nombre → lista, con los que no tienen valor fuera. */
export const agruparPor = (lista, campo) =>
  lista.reduce((grupos, item) => {
    if (!item[campo]) return grupos;
    grupos.set(item[campo], [...(grupos.get(item[campo]) || []), item]);
    return grupos;
  }, new Map());

/** "Tigres 104" / "Tigres" / "Dest. 104": para las listas flotantes. */
export const nombreDeDestacamento = (d) =>
  [d.nombre, d.numero].filter(Boolean).join(' ') || `Dest. ${d.id}`;
