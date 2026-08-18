// Con extension explicita: este modulo se carga tambien desde `node --test`, y
// el resolvedor de ESM no la deduce.
import { tieneCasillaEnOrganigrama } from './directiva-diagrams.js';

export const DIRECTIVA_LEVELS = {
  nacional: 'nacional',
  regional: 'regional',
  seccional: 'seccional',
  destacamento: 'destacamento',
};

export const DIRECTIVA_DIVISIONS = {
  navegantes: 'navegantes',
  pioneros: 'pioneros',
  seguidores: 'seguidores',
  exploradores: 'exploradores',
};

export const DIRECTIVA_DIVISION_NAMES = {
  [DIRECTIVA_DIVISIONS.navegantes]: 'Navegantes',
  [DIRECTIVA_DIVISIONS.pioneros]: 'Pioneros',
  [DIRECTIVA_DIVISIONS.seguidores]: 'Seguidores',
  [DIRECTIVA_DIVISIONS.exploradores]: 'Exploradores',
};

export const NATIONAL_LEADERSHIP_LEVELS = [
  { value: 'none', label: 'Ninguna' },
  { value: DIRECTIVA_LEVELS.nacional, label: 'Nivel Nacional' },
  { value: DIRECTIVA_LEVELS.regional, label: 'Nivel Regional' },
  { value: DIRECTIVA_LEVELS.seccional, label: 'Nivel Seccional' },
];

// Ids de la tabla `Cargos` de la API (.NET). TODO cargo asignable del organigrama
// tiene aqui su id: es lo que permite leer de vuelta la posicion de un miembro
// desde `CargosMiembros` y pintarla en la lista y en la Directiva. Sin el id, el
// cruce cae en el fallback POR NOMBRE, que no casa cuando el nombre guardado va
// cualificado con su nivel/division ("Coordinador de Promocion (Regional)").
//
// Se sincronizan con `node scripts/sync-cargos-api.mjs` (simulacro por defecto,
// `--apply` para escribir). Los ids 1-14 son los originales; 20-50 se crearon en
// el sembrado del catalogo completo.
const API_CARGO_IDS = {
  directorNacional: 1,
  subDirectorNacional: 2,
  tesoreroEjecutivo: 3,
  capellanNacional: 4,
  coordinadorNacionalAdiestramiento: 5,
  directorMinisteriosInfantiles: 6,
  directorRegional: 7,
  subdirectorRegional: 8,
  capellanRegional: 9,
  coordinadorAdiestramientoRegional: 10,
  directorSeccional: 11,
  subdirectorSeccional: 12,
  secretarioSeccional: 13,
  tesoreroSeccional: 14,
  apiPlaceholderString: 15,
  // --- Nivel nacional ---
  ministeriosInfantiles: 20,
  oficialesAdiestramientosEspeciales: 21,
  coordinadorNacionalPromocion: 22,
  coordinadorNacionalProduccion: 23,
  coordinadorNacionalPrograma: 24,
  comitesEspeciales: 25,
  // --- Nivel regional ---
  coordinadorPromocionRegional: 26,
  coordinadorProduccionRegional: 27,
  coordinadorProgramaRegional: 28,
  secretarioRegional: 29,
  // --- Nivel seccional ---
  coordinadorSeccional: 30,
  capellanSeccional: 31,
  subCoordinadorSeccional: 32,
  coordinadorAdiestramientoSeccional: 33,
  coordinadorPromocionSeccional: 34,
  coordinadorProduccionSeccional: 35,
  coordinadorProgramaSeccional: 36,
  secretarioRegionalSeccional: 37,
  // --- Nivel destacamento ---
  pastorDestacamento: 38,
  coordinadorDestacamento: 39,
  coordinadorAsistenteDestacamento: 40,
  consejoDestacamento: 41,
  capellanDestacamento: 42,
  liderGrupoNavegantes: 43,
  liderAsistenteGrupoNavegantes: 44,
  liderGrupoPioneros: 45,
  liderAsistenteGrupoPioneros: 46,
  liderGrupoSeguidores: 47,
  liderAsistenteGrupoSeguidores: 48,
  liderGrupoExploradores: 49,
  liderAsistenteGrupoExploradores: 50,
};

// Ids de los cargos de division del destacamento, por division. Lider de Grupo y
// su Asistente existen CUATRO veces (una por division) y en la API se distinguen
// solo por el nombre, asi que el id se resuelve aqui.
const API_CARGO_IDS_POR_DIVISION = {
  navegantes: {
    lider: API_CARGO_IDS.liderGrupoNavegantes,
    liderAsistente: API_CARGO_IDS.liderAsistenteGrupoNavegantes,
  },
  pioneros: {
    lider: API_CARGO_IDS.liderGrupoPioneros,
    liderAsistente: API_CARGO_IDS.liderAsistenteGrupoPioneros,
  },
  seguidores: {
    lider: API_CARGO_IDS.liderGrupoSeguidores,
    liderAsistente: API_CARGO_IDS.liderAsistenteGrupoSeguidores,
  },
  exploradores: {
    lider: API_CARGO_IDS.liderGrupoExploradores,
    liderAsistente: API_CARGO_IDS.liderAsistenteGrupoExploradores,
  },
};

const createPosition = ({
  idCargo,
  nivel,
  nombreCargo,
  idNodoDiagrama,
  idCargoPadre = '',
  idNodoPadre = '',
  nombreCargoPadre = '',
  division = null,
  orden,
  tipoNodo = 'cargo',
  asignable = true,
  idCargoApi = null,
  activo = true,
}) => ({
  idCargo,
  idCargoApi,
  nivel,
  nivelOrganizacional: nivel,
  nombreCargo,
  idNodoDiagrama: idNodoDiagrama || idCargo,
  idCargoPadre,
  idNodoPadre,
  nombreCargoPadre,
  division,
  nombreDivision: division ? DIRECTIVA_DIVISION_NAMES[division] || '' : '',
  orden,
  tipoNodo,
  asignable,
  activo,
});

const createDivisionPosition = (division, orden) =>
  createPosition({
    idCargo: `destacamento-division-${division}`,
    nivel: DIRECTIVA_LEVELS.destacamento,
    nombreCargo: DIRECTIVA_DIVISION_NAMES[division],
    idNodoDiagrama: division,
    division,
    orden,
    tipoNodo: 'division',
    asignable: false,
  });

const createDestDivisionPositions = (division, ordenBase) => {
  const idCargoDivision = `destacamento-division-${division}`;
  const idCargoLider = `destacamento-${division}-lider-grupo`;

  return [
    createDivisionPosition(division, ordenBase),
    createPosition({
      idCargo: idCargoLider,
      idCargoApi: API_CARGO_IDS_POR_DIVISION[division]?.lider ?? null,
      nivel: DIRECTIVA_LEVELS.destacamento,
      nombreCargo: 'Líder de Grupo',
      idNodoDiagrama: `lider-grupo-${division}`,
      idCargoPadre: idCargoDivision,
      idNodoPadre: division,
      nombreCargoPadre: DIRECTIVA_DIVISION_NAMES[division],
      division,
      orden: ordenBase + 1,
    }),
    createPosition({
      idCargo: `destacamento-${division}-lider-asistente-grupo`,
      idCargoApi: API_CARGO_IDS_POR_DIVISION[division]?.liderAsistente ?? null,
      nivel: DIRECTIVA_LEVELS.destacamento,
      nombreCargo: 'Líder Asistente de Grupo',
      idNodoDiagrama: `lider-asistente-grupo-${division}`,
      idCargoPadre: idCargoLider,
      idNodoPadre: `lider-grupo-${division}`,
      nombreCargoPadre: 'Líder de Grupo',
      division,
      orden: ordenBase + 2,
    }),
  ];
};

const DIRECTIVA_POSITIONS_DECLARADAS = [
  createPosition({
    idCargo: 'nacional-asambleas-de-dios',
    nivel: DIRECTIVA_LEVELS.nacional,
    nombreCargo: 'Concilio de las Asambleas de Dios, INC.',
    idNodoDiagrama: 'asambleas-de-dios',
    orden: 1,
    asignable: false,
  }),
  createPosition({
    idCargo: 'nacional-ministerios-infantiles',
    idCargoApi: API_CARGO_IDS.ministeriosInfantiles,
    nivel: DIRECTIVA_LEVELS.nacional,
    nombreCargo: 'Ministerios Infantiles',
    idNodoDiagrama: 'ministerios-infantiles',
    idCargoPadre: 'nacional-asambleas-de-dios',
    idNodoPadre: 'asambleas-de-dios',
    nombreCargoPadre: 'Concilio de las Asambleas de Dios, INC.',
    orden: 2,
  }),
  createPosition({
    idCargo: 'nacional-consejo-nacional',
    nivel: DIRECTIVA_LEVELS.nacional,
    nombreCargo: 'Consejo Nacional',
    idNodoDiagrama: 'consejo-nacional',
    idCargoPadre: 'nacional-ministerios-infantiles',
    idNodoPadre: 'ministerios-infantiles',
    nombreCargoPadre: 'Ministerios Infantiles',
    orden: 3,
    asignable: false,
  }),
  createPosition({
    idCargo: 'nacional-director-nacional',
    idCargoApi: API_CARGO_IDS.directorNacional,
    nivel: DIRECTIVA_LEVELS.nacional,
    nombreCargo: 'Director Nacional',
    idNodoDiagrama: 'director-nacional',
    idCargoPadre: 'nacional-consejo-nacional',
    idNodoPadre: 'consejo-nacional',
    nombreCargoPadre: 'Consejo Nacional',
    orden: 4,
  }),
  createPosition({
    idCargo: 'nacional-capellan-nacional',
    idCargoApi: API_CARGO_IDS.capellanNacional,
    nivel: DIRECTIVA_LEVELS.nacional,
    nombreCargo: 'Capellán Nacional',
    idNodoDiagrama: 'capellan-nacional',
    idCargoPadre: 'nacional-consejo-nacional',
    idNodoPadre: 'consejo-nacional',
    nombreCargoPadre: 'Consejo Nacional',
    orden: 5,
  }),
  createPosition({
    idCargo: 'nacional-consejo-ejecutivo',
    nivel: DIRECTIVA_LEVELS.nacional,
    nombreCargo: 'Consejo Ejecutivo',
    idNodoDiagrama: 'consejo-ejecutivo',
    idCargoPadre: 'nacional-director-nacional',
    idNodoPadre: 'director-nacional',
    nombreCargoPadre: 'Director Nacional',
    orden: 6,
    asignable: false,
  }),
  createPosition({
    idCargo: 'nacional-coordinador-adiestramiento',
    idCargoApi: API_CARGO_IDS.coordinadorNacionalAdiestramiento,
    nivel: DIRECTIVA_LEVELS.nacional,
    nombreCargo: 'Coordinador Nacional de Adiestramiento',
    idNodoDiagrama: 'coordinador-nacional-adiestramiento',
    idCargoPadre: 'nacional-consejo-ejecutivo',
    idNodoPadre: 'consejo-ejecutivo',
    nombreCargoPadre: 'Consejo Ejecutivo',
    orden: 7,
  }),
  createPosition({
    idCargo: 'nacional-oficiales-adiestramientos-especiales',
    idCargoApi: API_CARGO_IDS.oficialesAdiestramientosEspeciales,
    nivel: DIRECTIVA_LEVELS.nacional,
    nombreCargo: 'Oficiales de Adiestramientos Especiales',
    idNodoDiagrama: 'oficiales-adiestramientos-especiales',
    idCargoPadre: 'nacional-coordinador-adiestramiento',
    idNodoPadre: 'coordinador-nacional-adiestramiento',
    nombreCargoPadre: 'Coordinador Nacional de Adiestramiento',
    orden: 8,
  }),
  createPosition({
    idCargo: 'nacional-sub-director-nacional',
    idCargoApi: API_CARGO_IDS.subDirectorNacional,
    nivel: DIRECTIVA_LEVELS.nacional,
    nombreCargo: 'Sub-Director Nacional',
    idNodoDiagrama: 'sub-director-nacional',
    idCargoPadre: 'nacional-consejo-ejecutivo',
    idNodoPadre: 'consejo-ejecutivo',
    nombreCargoPadre: 'Consejo Ejecutivo',
    orden: 9,
  }),
  createPosition({
    idCargo: 'nacional-tesorero-ejecutivo',
    idCargoApi: API_CARGO_IDS.tesoreroEjecutivo,
    nivel: DIRECTIVA_LEVELS.nacional,
    nombreCargo: 'Tesorero Ejecutivo',
    idNodoDiagrama: 'tesorero-ejecutivo',
    idCargoPadre: 'nacional-consejo-ejecutivo',
    idNodoPadre: 'consejo-ejecutivo',
    nombreCargoPadre: 'Consejo Ejecutivo',
    orden: 10,
  }),
  createPosition({
    idCargo: 'nacional-coordinador-promocion',
    idCargoApi: API_CARGO_IDS.coordinadorNacionalPromocion,
    nivel: DIRECTIVA_LEVELS.nacional,
    nombreCargo: 'Coordinador Nacional de Promoción',
    idNodoDiagrama: 'coordinador-nacional-promocion',
    idCargoPadre: 'nacional-consejo-ejecutivo',
    idNodoPadre: 'consejo-ejecutivo',
    nombreCargoPadre: 'Consejo Ejecutivo',
    orden: 11,
  }),
  createPosition({
    idCargo: 'nacional-coordinador-produccion',
    idCargoApi: API_CARGO_IDS.coordinadorNacionalProduccion,
    nivel: DIRECTIVA_LEVELS.nacional,
    nombreCargo: 'Coordinador Nacional de Producción',
    idNodoDiagrama: 'coordinador-nacional-produccion',
    idCargoPadre: 'nacional-consejo-ejecutivo',
    idNodoPadre: 'consejo-ejecutivo',
    nombreCargoPadre: 'Consejo Ejecutivo',
    orden: 12,
  }),
  createPosition({
    idCargo: 'nacional-coordinador-programa',
    idCargoApi: API_CARGO_IDS.coordinadorNacionalPrograma,
    nivel: DIRECTIVA_LEVELS.nacional,
    nombreCargo: 'Coordinador Nacional de Programa',
    idNodoDiagrama: 'coordinador-nacional-programa',
    idCargoPadre: 'nacional-consejo-ejecutivo',
    idNodoPadre: 'consejo-ejecutivo',
    nombreCargoPadre: 'Consejo Ejecutivo',
    orden: 13,
  }),
  createPosition({
    idCargo: 'nacional-comites-especiales',
    idCargoApi: API_CARGO_IDS.comitesEspeciales,
    nivel: DIRECTIVA_LEVELS.nacional,
    nombreCargo: 'Comités Especiales',
    idNodoDiagrama: 'comites-especiales',
    idCargoPadre: 'nacional-consejo-ejecutivo',
    idNodoPadre: 'consejo-ejecutivo',
    nombreCargoPadre: 'Consejo Ejecutivo',
    orden: 14,
  }),
  createPosition({
    idCargo: 'nacional-director-ministerios-infantiles-api',
    idCargoApi: API_CARGO_IDS.directorMinisteriosInfantiles,
    nivel: DIRECTIVA_LEVELS.nacional,
    nombreCargo: 'Director Ministerios Infantiles',
    idNodoDiagrama: 'director-ministerios-infantiles',
    idCargoPadre: 'nacional-ministerios-infantiles',
    idNodoPadre: 'ministerios-infantiles',
    nombreCargoPadre: 'Ministerios Infantiles',
    orden: 15,
  }),

  createPosition({
    idCargo: 'regional-consejo-ejecutivo',
    nivel: DIRECTIVA_LEVELS.regional,
    nombreCargo: 'Consejo Ejecutivo',
    idNodoDiagrama: 'consejo-ejecutivo',
    orden: 1,
    asignable: false,
  }),
  createPosition({
    idCargo: 'regional-directiva-regional',
    nivel: DIRECTIVA_LEVELS.regional,
    nombreCargo: 'Directiva Regional',
    idNodoDiagrama: 'directiva-regional',
    idCargoPadre: 'regional-consejo-ejecutivo',
    idNodoPadre: 'consejo-ejecutivo',
    nombreCargoPadre: 'Consejo Ejecutivo',
    orden: 2,
    tipoNodo: 'estructura',
    asignable: false,
  }),
  createPosition({
    idCargo: 'regional-director-regional',
    idCargoApi: API_CARGO_IDS.directorRegional,
    nivel: DIRECTIVA_LEVELS.regional,
    nombreCargo: 'Director Regional',
    idNodoDiagrama: 'director-regional',
    idCargoPadre: 'regional-directiva-regional',
    idNodoPadre: 'directiva-regional',
    nombreCargoPadre: 'Directiva Regional',
    orden: 3,
  }),
  createPosition({
    idCargo: 'regional-capellan-regional',
    idCargoApi: API_CARGO_IDS.capellanRegional,
    nivel: DIRECTIVA_LEVELS.regional,
    nombreCargo: 'Capellán Regional',
    idNodoDiagrama: 'capellan-regional',
    idCargoPadre: 'regional-consejo-ejecutivo',
    idNodoPadre: 'consejo-ejecutivo',
    nombreCargoPadre: 'Consejo Ejecutivo',
    orden: 4,
  }),
  createPosition({
    idCargo: 'regional-subdirector-regional',
    idCargoApi: API_CARGO_IDS.subdirectorRegional,
    nivel: DIRECTIVA_LEVELS.regional,
    nombreCargo: 'Subdirector Regional',
    idNodoDiagrama: 'subdirector-regional',
    idCargoPadre: 'regional-directiva-regional',
    idNodoPadre: 'directiva-regional',
    nombreCargoPadre: 'Directiva Regional',
    orden: 5,
  }),
  createPosition({
    idCargo: 'regional-coordinador-adiestramiento',
    idCargoApi: API_CARGO_IDS.coordinadorAdiestramientoRegional,
    nivel: DIRECTIVA_LEVELS.regional,
    nombreCargo: 'Coordinador de Adiestramiento',
    idNodoDiagrama: 'coordinador-adiestramiento',
    idCargoPadre: 'regional-directiva-regional',
    idNodoPadre: 'directiva-regional',
    nombreCargoPadre: 'Directiva Regional',
    orden: 6,
  }),
  createPosition({
    idCargo: 'regional-coordinador-promocion',
    idCargoApi: API_CARGO_IDS.coordinadorPromocionRegional,
    nivel: DIRECTIVA_LEVELS.regional,
    nombreCargo: 'Coordinador de Promoción',
    idNodoDiagrama: 'coordinador-promocion',
    idCargoPadre: 'regional-directiva-regional',
    idNodoPadre: 'directiva-regional',
    nombreCargoPadre: 'Directiva Regional',
    orden: 7,
  }),
  createPosition({
    idCargo: 'regional-coordinador-produccion',
    idCargoApi: API_CARGO_IDS.coordinadorProduccionRegional,
    nivel: DIRECTIVA_LEVELS.regional,
    nombreCargo: 'Coordinador de Producción',
    idNodoDiagrama: 'coordinador-produccion',
    idCargoPadre: 'regional-directiva-regional',
    idNodoPadre: 'directiva-regional',
    nombreCargoPadre: 'Directiva Regional',
    orden: 8,
  }),
  createPosition({
    idCargo: 'regional-coordinador-programa',
    idCargoApi: API_CARGO_IDS.coordinadorProgramaRegional,
    nivel: DIRECTIVA_LEVELS.regional,
    nombreCargo: 'Coordinador de Programa',
    idNodoDiagrama: 'coordinador-programa',
    idCargoPadre: 'regional-directiva-regional',
    idNodoPadre: 'directiva-regional',
    nombreCargoPadre: 'Directiva Regional',
    orden: 9,
  }),
  createPosition({
    idCargo: 'regional-secretario-regional',
    idCargoApi: API_CARGO_IDS.secretarioRegional,
    nivel: DIRECTIVA_LEVELS.regional,
    nombreCargo: 'Secretario Regional',
    idNodoDiagrama: 'secretario-regional',
    idCargoPadre: 'regional-directiva-regional',
    idNodoPadre: 'directiva-regional',
    nombreCargoPadre: 'Directiva Regional',
    orden: 10,
  }),

  createPosition({
    idCargo: 'seccional-directiva-regional',
    nivel: DIRECTIVA_LEVELS.seccional,
    nombreCargo: 'Directiva Regional',
    idNodoDiagrama: 'directiva-regional',
    orden: 1,
    tipoNodo: 'estructura',
    asignable: false,
  }),
  createPosition({
    idCargo: 'seccional-director-seccional',
    idCargoApi: API_CARGO_IDS.directorSeccional,
    nivel: DIRECTIVA_LEVELS.seccional,
    nombreCargo: 'Director Seccional',
    idNodoDiagrama: 'director-seccional',
    idCargoPadre: 'seccional-directiva-regional',
    idNodoPadre: 'directiva-regional',
    nombreCargoPadre: 'Directiva Regional',
    orden: 2,
  }),
  createPosition({
    idCargo: 'seccional-coordinador-seccional',
    idCargoApi: API_CARGO_IDS.coordinadorSeccional,
    nivel: DIRECTIVA_LEVELS.seccional,
    nombreCargo: 'Coordinador Seccional',
    idNodoDiagrama: 'coordinador-seccional',
    idCargoPadre: 'seccional-directiva-regional',
    idNodoPadre: 'directiva-regional',
    nombreCargoPadre: 'Directiva Regional',
    orden: 3,
  }),
  createPosition({
    idCargo: 'seccional-capellan-seccional',
    idCargoApi: API_CARGO_IDS.capellanSeccional,
    nivel: DIRECTIVA_LEVELS.seccional,
    nombreCargo: 'Capellán Seccional',
    idNodoDiagrama: 'capellan-seccional',
    idCargoPadre: 'seccional-directiva-regional',
    idNodoPadre: 'directiva-regional',
    nombreCargoPadre: 'Directiva Regional',
    orden: 4,
  }),
  createPosition({
    idCargo: 'seccional-subdirector-seccional',
    idCargoApi: API_CARGO_IDS.subdirectorSeccional,
    nivel: DIRECTIVA_LEVELS.seccional,
    nombreCargo: 'Subdirector Seccional',
    idNodoDiagrama: 'subdirector-seccional',
    idCargoPadre: 'seccional-coordinador-seccional',
    idNodoPadre: 'coordinador-seccional',
    nombreCargoPadre: 'Coordinador Seccional',
    orden: 5,
  }),
  createPosition({
    idCargo: 'seccional-sub-coordinador-seccional',
    idCargoApi: API_CARGO_IDS.subCoordinadorSeccional,
    nivel: DIRECTIVA_LEVELS.seccional,
    nombreCargo: 'Sub-Coordinador Seccional',
    idNodoDiagrama: 'sub-coordinador-seccional',
    idCargoPadre: 'seccional-coordinador-seccional',
    idNodoPadre: 'coordinador-seccional',
    nombreCargoPadre: 'Coordinador Seccional',
    orden: 6,
  }),
  createPosition({
    idCargo: 'seccional-coordinador-adiestramiento',
    idCargoApi: API_CARGO_IDS.coordinadorAdiestramientoSeccional,
    nivel: DIRECTIVA_LEVELS.seccional,
    nombreCargo: 'Coordinador de Adiestramiento',
    idNodoDiagrama: 'coordinador-adiestramiento',
    idCargoPadre: 'seccional-coordinador-seccional',
    idNodoPadre: 'coordinador-seccional',
    nombreCargoPadre: 'Coordinador Seccional',
    orden: 7,
  }),
  createPosition({
    idCargo: 'seccional-coordinador-promocion',
    idCargoApi: API_CARGO_IDS.coordinadorPromocionSeccional,
    nivel: DIRECTIVA_LEVELS.seccional,
    nombreCargo: 'Coordinador de Promoción',
    idNodoDiagrama: 'coordinador-promocion',
    idCargoPadre: 'seccional-coordinador-seccional',
    idNodoPadre: 'coordinador-seccional',
    nombreCargoPadre: 'Coordinador Seccional',
    orden: 8,
  }),
  createPosition({
    idCargo: 'seccional-coordinador-produccion',
    idCargoApi: API_CARGO_IDS.coordinadorProduccionSeccional,
    nivel: DIRECTIVA_LEVELS.seccional,
    nombreCargo: 'Coordinador de Producción',
    idNodoDiagrama: 'coordinador-produccion',
    idCargoPadre: 'seccional-coordinador-seccional',
    idNodoPadre: 'coordinador-seccional',
    nombreCargoPadre: 'Coordinador Seccional',
    orden: 9,
  }),
  createPosition({
    idCargo: 'seccional-coordinador-programa',
    idCargoApi: API_CARGO_IDS.coordinadorProgramaSeccional,
    nivel: DIRECTIVA_LEVELS.seccional,
    nombreCargo: 'Coordinador de Programa',
    idNodoDiagrama: 'coordinador-programa',
    idCargoPadre: 'seccional-coordinador-seccional',
    idNodoPadre: 'coordinador-seccional',
    nombreCargoPadre: 'Coordinador Seccional',
    orden: 10,
  }),
  createPosition({
    idCargo: 'seccional-secretario-seccional',
    idCargoApi: API_CARGO_IDS.secretarioSeccional,
    nivel: DIRECTIVA_LEVELS.seccional,
    nombreCargo: 'Secretario Seccional',
    idNodoDiagrama: 'secretario-seccional',
    idCargoPadre: 'seccional-coordinador-seccional',
    idNodoPadre: 'coordinador-seccional',
    nombreCargoPadre: 'Coordinador Seccional',
    orden: 11,
  }),
  createPosition({
    idCargo: 'seccional-tesorero-seccional',
    idCargoApi: API_CARGO_IDS.tesoreroSeccional,
    nivel: DIRECTIVA_LEVELS.seccional,
    nombreCargo: 'Tesorero Seccional',
    idNodoDiagrama: 'tesorero-seccional',
    idCargoPadre: 'seccional-coordinador-seccional',
    idNodoPadre: 'coordinador-seccional',
    nombreCargoPadre: 'Coordinador Seccional',
    orden: 12,
  }),
  createPosition({
    idCargo: 'seccional-secretario-regional',
    idCargoApi: API_CARGO_IDS.secretarioRegionalSeccional,
    nivel: DIRECTIVA_LEVELS.seccional,
    nombreCargo: 'Secretario Regional',
    idNodoDiagrama: 'secretario-regional',
    idCargoPadre: 'seccional-coordinador-seccional',
    idNodoPadre: 'coordinador-seccional',
    nombreCargoPadre: 'Coordinador Seccional',
    orden: 13,
  }),
  createPosition({
    idCargo: 'seccional-zonas',
    nivel: DIRECTIVA_LEVELS.seccional,
    nombreCargo: 'Zonas',
    idNodoDiagrama: 'zonas',
    idCargoPadre: 'seccional-coordinador-seccional',
    idNodoPadre: 'coordinador-seccional',
    nombreCargoPadre: 'Coordinador Seccional',
    orden: 14,
    asignable: false,
  }),
  createPosition({
    idCargo: 'seccional-grupos-locales',
    nivel: DIRECTIVA_LEVELS.seccional,
    nombreCargo: 'Grupos Locales',
    idNodoDiagrama: 'grupos-locales',
    idCargoPadre: 'seccional-zonas',
    idNodoPadre: 'zonas',
    nombreCargoPadre: 'Zonas',
    orden: 15,
    asignable: false,
  }),

  createPosition({
    idCargo: 'destacamento-pastor',
    idCargoApi: API_CARGO_IDS.pastorDestacamento,
    nivel: DIRECTIVA_LEVELS.destacamento,
    nombreCargo: 'Pastor',
    idNodoDiagrama: 'pastor',
    orden: 1,
  }),
  createPosition({
    idCargo: 'destacamento-coordinador-destacamento',
    idCargoApi: API_CARGO_IDS.coordinadorDestacamento,
    nivel: DIRECTIVA_LEVELS.destacamento,
    nombreCargo: 'Coordinador de Destacamento',
    idNodoDiagrama: 'coordinador-destacamento',
    idCargoPadre: 'destacamento-pastor',
    idNodoPadre: 'pastor',
    nombreCargoPadre: 'Pastor',
    orden: 2,
  }),
  createPosition({
    idCargo: 'destacamento-coordinador-asistente-destacamento',
    idCargoApi: API_CARGO_IDS.coordinadorAsistenteDestacamento,
    nivel: DIRECTIVA_LEVELS.destacamento,
    nombreCargo: 'Coordinador Asistente de Destacamento',
    idNodoDiagrama: 'coordinador-asistente-destacamento',
    idCargoPadre: 'destacamento-coordinador-destacamento',
    idNodoPadre: 'coordinador-destacamento',
    nombreCargoPadre: 'Coordinador de Destacamento',
    orden: 3,
  }),
  createPosition({
    idCargo: 'destacamento-consejo-destacamento',
    idCargoApi: API_CARGO_IDS.consejoDestacamento,
    nivel: DIRECTIVA_LEVELS.destacamento,
    nombreCargo: 'Consejo Destacamento',
    idNodoDiagrama: 'consejo-destacamento',
    idCargoPadre: 'destacamento-coordinador-asistente-destacamento',
    idNodoPadre: 'coordinador-asistente-destacamento',
    nombreCargoPadre: 'Coordinador Asistente de Destacamento',
    orden: 4,
  }),
  createPosition({
    idCargo: 'destacamento-capellan',
    idCargoApi: API_CARGO_IDS.capellanDestacamento,
    nivel: DIRECTIVA_LEVELS.destacamento,
    nombreCargo: 'Capellán',
    idNodoDiagrama: 'capellan',
    idCargoPadre: 'destacamento-coordinador-asistente-destacamento',
    idNodoPadre: 'coordinador-asistente-destacamento',
    nombreCargoPadre: 'Coordinador Asistente de Destacamento',
    orden: 5,
  }),
  ...createDestDivisionPositions(DIRECTIVA_DIVISIONS.navegantes, 20),
  ...createDestDivisionPositions(DIRECTIVA_DIVISIONS.pioneros, 30),
  ...createDestDivisionPositions(DIRECTIVA_DIVISIONS.seguidores, 40),
  ...createDestDivisionPositions(DIRECTIVA_DIVISIONS.exploradores, 50),

  createPosition({
    idCargo: 'api-cargo-string-15',
    idCargoApi: API_CARGO_IDS.apiPlaceholderString,
    nivel: DIRECTIVA_LEVELS.nacional,
    nombreCargo: 'string',
    idNodoDiagrama: 'api-cargo-string-15',
    orden: 999,
    asignable: false,
    activo: false,
  }),
];

// UN CARGO ES ASIGNABLE SOLO SI EL ORGANIGRAMA LO DIBUJA. `asignable` declara la
// intencion (un cargo de verdad y no una caja de estructura como "Zonas" o
// "Consejo Ejecutivo"), pero la ultima palabra la tiene el arbol del nivel: si no
// hay casilla donde colocar a la persona, ofrecerlo en la ficha del miembro
// produce un cargo fantasma que despues no aparece en ninguna Directiva.
//
// Las posiciones siguen en la lista aunque dejen de ser asignables: conservan su
// `idCargoApi`, y con el se resuelve el NOMBRE de un cargo que algun miembro ya
// arrastre de antes. Quitarlas del catalogo dejaria esos registros sin traducir.
export const DIRECTIVA_POSITIONS = DIRECTIVA_POSITIONS_DECLARADAS.map((position) => ({
  ...position,
  asignable:
    position.asignable && tieneCasillaEnOrganigrama(position.nivel, position.idNodoDiagrama),
}));

export const CARGOS_DIRECTIVA_BASE = DIRECTIVA_POSITIONS;

export const DIRECTIVA_POSITIONS_BY_LEVEL = DIRECTIVA_POSITIONS.reduce((acc, position) => {
  const level = position.nivel || 'otros';

  acc[level] = acc[level] || [];
  acc[level].push(position);

  return acc;
}, {});

// ----------------------------------------------------------------------
// Reglas de ocupacion de cargos
// ----------------------------------------------------------------------

// UN CARGO, UN OCUPANTE. Para cada nivel, el ambito dentro del cual un cargo solo
// puede estar ocupado por una persona (y el texto con el que se nombra en el
// aviso). Añadir un nivel aqui basta para que la validacion lo cubra.
export const AMBITO_CARGO_UNICO_POR_NIVEL = {
  [DIRECTIVA_LEVELS.destacamento]: 'en este destacamento',
  [DIRECTIVA_LEVELS.seccional]: 'en esta sección',
  [DIRECTIVA_LEVELS.regional]: 'en esta región',
  [DIRECTIVA_LEVELS.nacional]: 'en el Consejo Nacional',
};

// UN SOLO CARGO DE NIVEL SUPERIOR. Un miembro no puede ser a la vez seccional y
// regional (ni nacional): son los tres niveles de supervision y comparten el
// mismo selector del formulario, asi que tener dos seria un estado que la ficha
// no puede ni representar. Al asignar uno de estos se retiran los otros dos.
//
// El DESTACAMENTO queda deliberadamente fuera: es compatible con cualquiera de
// ellos (se puede ser Lider de Grupo y ademas Coordinador Seccional).
export const NIVELES_CARGO_EXCLUYENTES = [
  DIRECTIVA_LEVELS.nacional,
  DIRECTIVA_LEVELS.regional,
  DIRECTIVA_LEVELS.seccional,
];

// Niveles cuyo cargo hay que retirar al asignar uno de `nivel`: siempre el propio
// (un cargo por nivel) y, si es de supervision, tambien los otros dos.
export const getNivelesARetirar = (nivel) =>
  NIVELES_CARGO_EXCLUYENTES.includes(nivel) ? [...NIVELES_CARGO_EXCLUYENTES] : [nivel];

// Puente entre este catalogo y el organigrama de la Directiva del destacamento
// (`organigrama_directiva_destacamentos`), que usa un enum propio y reducido de
// 7 cargos. Sin este mapa, guardar la posicion en la ficha del miembro NO se
// refleja en el cuadro jerarquico: son almacenes distintos.
//
// Los lideres de grupo comparten codigo entre las cuatro divisiones; alli la
// division es la que distingue la casilla del organigrama.
const ORGANIGRAMA_CARGO_POR_POSICION = {
  'destacamento-pastor': 'pastor',
  'destacamento-coordinador-destacamento': 'coordinador_destacamento',
  'destacamento-coordinador-asistente-destacamento': 'coordinador_asistente_destacamento',
  'destacamento-consejo-destacamento': 'consejo_destacamento',
  'destacamento-capellan': 'capellan',
  ...Object.values(DIRECTIVA_DIVISIONS).reduce(
    (acc, division) => ({
      ...acc,
      [`destacamento-${division}-lider-grupo`]: 'lider_grupo',
      [`destacamento-${division}-lider-asistente-grupo`]: 'lider_asistente_grupo',
    }),
    {}
  ),
};

// Casilla del organigrama que corresponde a una posicion del catalogo, o `null`
// si esa posicion no vive en el cuadro del destacamento (niveles superiores).
export const getOrganigramaDestSlot = (position = {}) => {
  const idPosicion = String(position?.idPosicionDirectiva ?? position?.idCargo ?? '');
  const cargo = ORGANIGRAMA_CARGO_POR_POSICION[idPosicion];

  if (!cargo) return null;

  // `orden` es 1 siempre: en el organigrama identifica la casilla dentro de un
  // mismo cargo+division (hoy hay una sola de cada), no el orden del catalogo.
  return { cargo, division: position?.division ?? null, orden: 1 };
};

export const DIRECTIVA_DEST_POSITIONS_BY_DIVISION = DIRECTIVA_POSITIONS.filter(
  (position) => position.nivel === DIRECTIVA_LEVELS.destacamento && position.division
).reduce((acc, position) => {
  const division = position.division;

  acc[division] = acc[division] || [];
  acc[division].push(position);

  return acc;
}, {});
