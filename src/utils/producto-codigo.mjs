// ----------------------------------------------------------------------
// EL CODIGO DE PRODUCTO SE ARMA SOLO, NUNCA A MANO.
//
// Cada categoria de fabrica tiene su prefijo fijo (Insignias y emblemas ->
// INS-EMB, Cintas -> CIN...) y dentro de cada una los numeros van en secuencia:
// INS-EMB-001, INS-EMB-002... Una categoria que no esta en la lista de fabrica
// (agregada con "+ Nuevo") usa las tres primeras letras de su nombre, sin
// acentos ni espacios.
//
// Sin React ni Firebase, para poder probarlo con `node --test`.
// ----------------------------------------------------------------------

export const PREFIJOS_CODIGO_PRODUCTO_DE_FABRICA = {
  'insignias-emblemas': 'INS-EMB',
  cintas: 'CIN',
  'barras-numeros': 'BAR-NUM',
  parches: 'PAR',
  uniformes: 'UNI',
  accesorios: 'ACC',
  'materiales-manuales': 'MAT',
  'campamentos-especiales': 'CAMP-ART',
  pines: 'PIN',
};

const soloLetras = (texto) =>
  String(texto ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '');

/** El prefijo del codigo para una categoria: el de fabrica, o las tres primeras letras del nombre. */
export const prefijoDeCategoriaProducto = (categoria, etiqueta) => {
  const clave = String(categoria ?? '').trim().toLowerCase();

  if (PREFIJOS_CODIGO_PRODUCTO_DE_FABRICA[clave]) {
    return PREFIJOS_CODIGO_PRODUCTO_DE_FABRICA[clave];
  }

  const base = soloLetras(etiqueta) || soloLetras(categoria);

  return base.slice(0, 3) || 'PRD';
};

export const formatearCodigoProducto = (prefijo, numero) =>
  `${prefijo}-${String(numero).padStart(3, '0')}`;

/** El siguiente numero libre para un prefijo, mirando los codigos que ya existen. */
export const siguienteNumeroCodigoProducto = (prefijo, codigosExistentes = []) => {
  const patron = new RegExp(`^${prefijo}-(\\d+)$`);

  const maximo = (Array.isArray(codigosExistentes) ? codigosExistentes : []).reduce(
    (mayor, codigo) => {
      const coincide = patron.exec(String(codigo ?? '').trim().toUpperCase());

      return coincide ? Math.max(mayor, Number(coincide[1])) : mayor;
    },
    0
  );

  return maximo + 1;
};

/** El codigo completo para el siguiente producto de una categoria. */
export const generarSiguienteCodigoProducto = ({
  categoria,
  etiqueta,
  codigosExistentes = [],
} = {}) => {
  const prefijo = prefijoDeCategoriaProducto(categoria, etiqueta);
  const numero = siguienteNumeroCodigoProducto(prefijo, codigosExistentes);

  return formatearCodigoProducto(prefijo, numero);
};
