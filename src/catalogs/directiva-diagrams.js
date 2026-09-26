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

const crearCadenaOficialesEspeciales = (cantidad = 20) => {
  let siguiente = null;

  for (let numero = Math.min(20, Math.max(0, cantidad)); numero >= 1; numero -= 1) {
    siguiente = createNode(
      `oficial-especial-${numero}`,
      'Oficial Especial',
      siguiente ? [siguiente] : []
    );
  }

  return siguiente;
};

export const NATIONAL_LEADERSHIP_DATA = {
  // Sin subtitulo: el nombre de la tarjeta ya lo dice, y repetirlo debajo
  // ("Concilio de las Asambleas de Dios" sobre "Concilio de las Asambleas de
  // Dios, INC.") solo gastaba una linea para decir lo mismo.
  ...createNode('asambleas-de-dios', '', [
    createNode('ministerios-infantiles', 'Ministerios infantiles', [
      {
        // El Consejo Ejecutivo NO es un cargo: es el cuerpo del que cuelga la
        // direccion, igual que el Concilio. Se dibuja como caja de estructura
        // —sin "Vacante" y sin menu de asignar— en vez de como una casilla que
        // invita a poner a alguien dentro.
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
            // Tambien caja de estructura, como el Consejo Nacional de arriba: es el
            // cuerpo del que cuelgan los coordinadores, no una casilla con "Vacante".
            // El id no cambia: el catalogo de posiciones lo usa como padre.
            {
              ...createNode('consejo-ejecutivo', '', [
                createNode('sub-director-nacional', 'Sub-Director Nacional'),
                createNode(
                  'coordinador-nacional-adiestramiento',
                  'Director Nacional de Adiestramiento',
                  [
                    createNode(
                      'oficiales-adiestramientos-especiales',
                      'Oficiales de Adiestramientos Especiales'
                    ),
                  ]
                ),
                createNode('coordinador-nacional-promocion', 'Director Nacional de Promoción'),
                createNode('coordinador-nacional-produccion', 'Director Nacional de Producción'),
                createNode('coordinador-nacional-programa', 'Director Nacional de Programa'),
                // Justo antes de Oficiales Especiales, en la misma fila.
                createNode('secretario-nacional', 'Secretario Nacional'),
                createNode('comites-especiales', 'Comités Especiales', [
                  crearCadenaOficialesEspeciales(20),
                ]),
              ]),
              name: 'Consejo Ejecutivo',
              avatarUrl: '/watermark.webp',
              isDivision: true,
            },
            createNode('capellan-nacional', 'Capellán Nacional'),
          ]),
        ]),
        // "Consejo Nacional": el cuerpo entero. "Consejo Ejecutivo" es la casilla de
        // debajo, y con los dos nombres iguales parecian la misma cosa repetida.
        name: 'Consejo Nacional',
        // La caja de estructura lleva el sello de la casa (watermark), no la "O"
        // de EXPLORA: es la marca de agua unica de las jerarquias y los niveles.
        avatarUrl: '/watermark.webp',
        isDivision: true,
      },
    ]),
  ]),
  name: 'Concilio de las Asambleas de Dios',
  avatarUrl: '/logo/asambleas-de-dios.png',
  isDivision: true,
};

// El catálogo contiene las veinte casillas posibles para que cada una tenga
// identidad y asignación propias. La vista actual muestra solo las creadas.
export const obtenerDiagramaNacionalConOficiales = (cantidadOficiales = 1) => {
  const idsOficiales = Array.isArray(cantidadOficiales)
    ? // El spread se cierra JUNTO al Set: si no, `.filter` se llamaba sobre el
      // propio Set (que no lo tiene) y el organigrama reventaba al abrir Jerarquía.
      [...new Set(cantidadOficiales.map((id) => String(id || '')))]
        .filter((id) => /^oficial-especial-(?:[1-9]|1\d|20)$/.test(id))
        .slice(0, 20)
    : Array.from(
        { length: Math.min(20, Math.max(0, Number(cantidadOficiales) || 0)) },
        (_, indice) => `oficial-especial-${indice + 1}`
      );
  let primero = null;

  idsOficiales
    .slice()
    .reverse()
    .forEach((id) => {
      const siguiente = primero;
      primero = createNode(id, 'Oficial Especial', siguiente ? [siguiente] : []);
    });
  const clonar = (nodo) => {
    const copia = { ...nodo };

    if (nodo.id === 'comites-especiales') {
      copia.children = primero ? [primero] : [];
    } else if (Array.isArray(nodo.children)) {
      copia.children = nodo.children.map(clonar);
    }

    return copia;
  };

  return clonar(NATIONAL_LEADERSHIP_DATA);
};

export const REGIONAL_LEADERSHIP_DATA = {
  // Caja de estructura, como el Consejo Ejecutivo: es el cuerpo del que cuelga la
  // Directiva Regional, no un cargo que alguien ocupe.
  ...createNode('consejo-ejecutivo', '', [
    createNode('directiva-regional', 'Directiva Regional', [
      // El Director Regional tenía cargo en el catálogo (y el formulario de la
      // región lo asigna) pero ninguna casilla: no salía en "Cargo Nacional" de
      // la ficha y quien lo ocupaba no se veía en el organigrama.
      createNode('director-regional', 'Director Regional'),
      createNode('sub-director-regional', 'Sub-Director Regional'),
      createNode('coordinador-adiestramiento', 'Coordinador de Adiestramiento'),
      createNode('coordinador-promocion', 'Coordinador de Promoción'),
      createNode('coordinador-produccion', 'Coordinador de Producción'),
      createNode('coordinador-programa', 'Coordinador de Programa'),
      createNode('secretario-regional', 'Secretario Regional'),
    ]),
    createNode('capellan-regional', 'Capellán Regional'),
  ]),
  name: 'Consejo Ejecutivo',
  // Mismo sello (watermark) que el organigrama nacional, en vez de la "O".
  avatarUrl: '/watermark.webp',
  isDivision: true,
};

export const SECTIONAL_LEADERSHIP_DATA = createNode('directiva-regional', 'Directiva Regional', [
  // El Director Seccional OCUPA la casilla que se llamaba "Coordinador
  // Seccional" (es el mismo cargo, y el que da el rol de sección); el id del
  // nodo no cambia para no perder las asignaciones ya guardadas. Igual con su
  // Sub-Director.
  createNode('coordinador-seccional', 'Director Seccional', [
    createNode('sub-coordinador-seccional', 'Sub-Director Seccional'),
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
