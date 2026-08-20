// Relativo y no por alias: este modulo se importa tambien desde las pruebas de
// `node --test`, que no resuelven el alias `src/`.
import { claveNodo } from '../utils/leadership-assignments.js';

// ----------------------------------------------------------------------
// Arboles de los organigramas de Directiva (nacion, region y seccion).
//
// Viven aqui, y no dentro de cada vista, porque son la FUENTE DE VERDAD de que
// cargos existen de verdad en cada nivel. El catalogo de posiciones
// (`directiva-positions`) los usa para decidir que se puede asignar: un cargo
// que no tiene casilla en el organigrama no se ofrece en el desplegable "Cargo
// Nacional" de la ficha del miembro.
//
// Antes cada vista declaraba su propio arbol y el catalogo enumeraba posiciones
// por su cuenta, asi que las dos listas se separaron sin que nada lo detectara:
// el desplegable ofrecia "Secretario Seccional", "Tesorero Seccional",
// "Director Seccional" y otros que ningun organigrama dibuja, y asignarlos
// producia un cargo que luego no aparecia en ninguna parte.
//
// El destacamento no esta aqui: su cuadro se dibuja contra su propia coleccion
// (`organigrama_directiva_destacamentos`) y su equivalencia la resuelve
// `getOrganigramaDestSlot`.
// ----------------------------------------------------------------------

// El nodo no trae nombre ni foto: los pone el ocupante real, y si no hay
// ocupante el cargo se dibuja como vacante.
export const createNode = (id, role, children) => ({ id, role, children });

export const NATIONAL_LEADERSHIP_DATA = {
  ...createNode('asambleas-de-dios', 'Concilio de las Asambleas de Dios, INC.', [
    createNode('ministerios-infantiles', 'Ministerios infantiles', [
      {
        // El Consejo Nacional NO es un cargo: es el cuerpo del que cuelga la
        // direccion, igual que el Concilio. Se dibuja como caja de estructura
        // —sin "Vacante" y sin menu de asignar— en vez de como una casilla que
        // invita a poner a alguien dentro.
        //
        // `avatarUrl` queda pendiente: en cuanto haya imagen, se rellena aqui y
        // la tarjeta la muestra sola.
        ...createNode('consejo-nacional', '', [
        createNode('director-nacional', 'Director Nacional', [
          // De IZQUIERDA A DERECHA POR RANGO. El Sub-Director Nacional encabeza
          // la fila: es el segundo de la direccion, por encima de los
          // coordinadores funcionales, y quedaba en segundo lugar solo porque el
          // `orden` del catalogo lo situa despues de Adiestramiento.
          //
          // Ese `orden` NO se toca: forma parte del id del documento de asignacion
          // (nivel_entidad_posicion_division_orden), asi que cambiarlo dejaria
          // huerfanas las asignaciones ya guardadas. El orden visual lo decide
          // este arbol; el del catalogo solo identifica.
          createNode('consejo-ejecutivo', 'Consejo Ejecutivo', [
            createNode('sub-director-nacional', 'Sub-Director Nacional'),
            createNode(
              'coordinador-nacional-adiestramiento',
              'Coordinador Nacional de Adiestramiento',
              [
                createNode(
                  'oficiales-adiestramientos-especiales',
                  'Oficiales de Adiestramientos Especiales'
                ),
              ]
            ),
            createNode('coordinador-nacional-promocion', 'Coordinador Nacional de Promoción'),
            createNode('coordinador-nacional-produccion', 'Coordinador Nacional de Producción'),
            createNode('coordinador-nacional-programa', 'Coordinador Nacional de Programa'),
            createNode('comites-especiales', 'Comités Especiales'),
          ]),
          createNode('capellan-nacional', 'Capellán Nacional'),
        ]),
        ]),
        name: 'Consejo Nacional',
        isDivision: true,
      },
    ]),
  ]),
  name: 'Concilio de las Asambleas de Dios',
  avatarUrl: '/logo/asambleas-de-dios.png',
  isDivision: true,
};

export const REGIONAL_LEADERSHIP_DATA = createNode('consejo-ejecutivo', 'Consejo Ejecutivo', [
  createNode('directiva-regional', 'Directiva Regional', [
    createNode('sub-director-regional', 'Sub-Director Regional'),
    createNode('coordinador-adiestramiento', 'Coordinador de Adiestramiento'),
    createNode('coordinador-promocion', 'Coordinador de Promoción'),
    createNode('coordinador-produccion', 'Coordinador de Producción'),
    createNode('coordinador-programa', 'Coordinador de Programa'),
    createNode('secretario-regional', 'Secretario Regional'),
  ]),
  createNode('capellan-regional', 'Capellán Regional'),
]);

export const SECTIONAL_LEADERSHIP_DATA = createNode('directiva-regional', 'Directiva Regional', [
  createNode('coordinador-seccional', 'Coordinador Seccional', [
    createNode('sub-coordinador-seccional', 'Sub-Coordinador Seccional'),
    createNode('coordinador-adiestramiento', 'Coordinador de Adiestramiento'),
    createNode('coordinador-promocion', 'Coordinador de Promoción'),
    createNode('coordinador-produccion', 'Coordinador de Producción'),
    createNode('coordinador-programa', 'Coordinador de Programa'),
    createNode('secretario-regional', 'Secretario Regional'),
    createNode('zonas', 'Zonas', [createNode('grupos-locales', 'Grupos Locales')]),
  ]),
  createNode('capellan-seccional', 'Capellán Seccional'),
]);

// Ids de TODOS los nodos de un arbol, en cualquier profundidad.
export const recogerIdsDeNodos = (nodo) => {
  if (!nodo?.id) return [];

  return [nodo.id, ...(nodo.children || []).flatMap(recogerIdsDeNodos)];
};

// Se guardan normalizados con `claveNodo`: los ids del diagrama y los del
// catalogo describen lo mismo pero no siempre se escriben igual
// ("sub-director-regional" frente a "subdirector-regional").
const construirClaves = (arbol) => new Set(recogerIdsDeNodos(arbol).map(claveNodo));

export const NODOS_DIAGRAMA_POR_NIVEL = {
  nacional: construirClaves(NATIONAL_LEADERSHIP_DATA),
  regional: construirClaves(REGIONAL_LEADERSHIP_DATA),
  seccional: construirClaves(SECTIONAL_LEADERSHIP_DATA),
};

// ¿El organigrama de ese nivel dibuja una casilla para este nodo? Los niveles sin
// arbol declarado (destacamento) responden `true`: su equivalencia se resuelve
// aparte y no se filtra aqui.
export const tieneCasillaEnOrganigrama = (nivel, idNodoDiagrama) => {
  const claves = NODOS_DIAGRAMA_POR_NIVEL[nivel];

  if (!claves) return true;

  return claves.has(claveNodo(idNodoDiagrama));
};
