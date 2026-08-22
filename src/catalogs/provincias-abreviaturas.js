// ----------------------------------------------------------------------
// Abreviatura de cada provincia dominicana. Es el prefijo del codigo de miembro:
// de la provincia de la iglesia del destacamento sale la letra, de modo que el
// codigo dice de un vistazo de donde es la persona.
//
// La fuente viva es la coleccion `catalogo_provincias` de Firestore; esta tabla
// es el respaldo local para cuando Firestore no responde, igual que hace el
// catalogo de posiciones de directiva. Las dos deben decir lo mismo.
// ----------------------------------------------------------------------

export const ABREVIATURAS_PROVINCIA = {
  Azua: 'AZ',
  Baoruco: 'BA',
  Barahona: 'BH',
  Dajabón: 'DA',
  'Distrito Nacional': 'DN',
  Duarte: 'DU',
  'Elías Piña': 'EP',
  'El Seibo': 'ES',
  Espaillat: 'ESP',
  'Hato Mayor': 'HM',
  'Hermanas Mirabal': 'HMI',
  Independencia: 'IN',
  'La Altagracia': 'LA',
  'La Romana': 'LR',
  'La Vega': 'LV',
  'María Trinidad Sánchez': 'MTS',
  'Monseñor Nouel': 'MN',
  'Monte Cristi': 'MC',
  'Monte Plata': 'MP',
  Pedernales: 'PE',
  Peravia: 'PV',
  'Puerto Plata': 'PP',
  Samaná: 'SA',
  'San Cristóbal': 'SC',
  'San José de Ocoa': 'SJO',
  'San Juan': 'SJ',
  'San Pedro de Macorís': 'SPM',
  'Sánchez Ramírez': 'SR',
  Santiago: 'STG',
  'Santiago Rodríguez': 'STR',
  'Santo Domingo': 'SD',
  Valverde: 'VV',
};

// Prefijo de reserva cuando no se puede averiguar la provincia: la iglesia no
// tiene direccion, o el miembro todavia no pertenece a ningun destacamento.
export const PREFIJO_PROVINCIA_DESCONOCIDA = 'SD';

// El codigo empieza por el pais: hoy solo hay Republica Dominicana, pero la
// organizacion se abrira a otros y entonces DO-SD-10001 y PA-SD-10001 tienen que
// poder convivir. Se guarda como dato, no fijo en el codigo.
//
// La abreviatura sigue el codigo ISO del pais (Republica Dominicana = DO). Hay
// tabla propia por si algun pais necesita otra; para los que no esten, sirve el
// ISO que devuelve la API.
export const ABREVIATURAS_PAIS = {
  1: 'DO',
};

export const PREFIJO_PAIS_POR_DEFECTO = 'DO';

// `RD` fue la abreviatura inicial de Republica Dominicana y ya no se usa. La
// tabla viva esta en Firestore, asi que puede seguir trayendola durante un
// tiempo: se traduce al leerla, para que ninguna fuente vuelva a emitir codigos
// `RD-`. Los codigos ya emitidos NO se renombran (son el usuario de acceso del
// miembro), pero cuentan como DO al numerar: ver `generateMemberId`.
export const ABREVIATURAS_PAIS_OBSOLETAS = {
  RD: 'DO',
};

export const normalizarAbreviaturaPais = (abreviatura) => {
  const valor = String(abreviatura ?? '')
    .trim()
    .toUpperCase();

  return ABREVIATURAS_PAIS_OBSOLETAS[valor] || valor;
};

export const PRIMER_NUMERO_MIEMBRO = 10001;

// "Santo Domingo Este" no es la provincia Santo Domingo, y "santo domingo" con
// otra tilde tampoco deja de serlo: se compara sin acentos ni mayusculas, y se
// exige el nombre completo.
const sinAcentos = (texto = '') =>
  String(texto)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

export const abreviaturaDeProvincia = (nombreProvincia, tabla = ABREVIATURAS_PROVINCIA) => {
  const buscado = sinAcentos(nombreProvincia);

  if (!buscado) return '';

  const encontrada = Object.entries(tabla).find(([nombre]) => sinAcentos(nombre) === buscado);

  return encontrada ? encontrada[1] : '';
};
