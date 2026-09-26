// ----------------------------------------------------------------------
// Casillas y contenedores añadidos a mano en los organigramas de Directiva.
//
// Los árboles de fábrica viven en el código (`directiva-diagrams.js` y
// `dest-leadership-data.js`) y el catálogo de cargos sale de ellos: un cargo
// nuevo exigía tocar código. Ahora el Administrador Global añade desde el propio
// organigrama una CASILLA (un cargo que se asigna a una persona) o un
// CONTENEDOR (una caja que agrupa casillas, como "Zonas") con el nombre que
// quiera.
//
// ES GLOBAL POR NIVEL: una casilla creada en la directiva de una sección sale
// en TODAS las secciones, igual que las de fábrica, porque el árbol de un
// nivel es uno solo. Y como catálogo y árbol son la misma cosa, la casilla
// sale también en la ficha del miembro: "Cargo Nacional" para nación, región y
// sección, y "Nivel posición en tu Destacamento" para el destacamento.
//
// Se guardan en `casillas_directiva_personalizadas`. Quitar una la marca
// inactiva (no se borra): así un nombre ya asignado sigue traduciéndose en el
// historial en vez de quedar como un id suelto.
//
// Relativo y con extensión: lo importan también las pruebas de `node --test`.
// ----------------------------------------------------------------------

export const COLECCION_CASILLAS_PERSONALIZADAS = 'casillas_directiva_personalizadas';

export const NIVELES_CON_CASILLAS = ['nacional', 'regional', 'seccional', 'destacamento'];

export const TIPOS_CASILLA = Object.freeze({
  casilla: 'casilla',
  contenedor: 'contenedor',
});

export const LARGO_NOMBRE_CASILLA = Object.freeze({ minimo: 2, maximo: 60 });

const DIVISIONES = ['navegantes', 'pioneros', 'seguidores', 'exploradores'];
const NOMBRE_DIVISION = {
  navegantes: 'Navegantes',
  pioneros: 'Pioneros',
  seguidores: 'Seguidores',
  exploradores: 'Exploradores',
};

// Id corto, sin datos de nadie y que no choca con los de fábrica: el prefijo
// `c` y la fecha en base 36 ("c-lz3k9x1a"). Del id salen la posición del
// catálogo, el nodo del árbol y la clave de su asignación, así que no se
// renumera nunca.
export const crearIdCasilla = (ahora = Date.now()) => `c${Number(ahora).toString(36)}`;

const ES_ID_CASILLA = /^c[a-z0-9]{4,20}$/;
const ES_ID_NODO = /^[a-z0-9-]{1,80}$/;

const texto = (valor) => String(valor ?? '').trim();

/** El nombre tal como se guarda: sin espacios de sobra. */
export const limpiarNombreCasilla = (nombre) => texto(nombre).replace(/\s+/g, ' ');

/**
 * La ficha saneada, o `null` si no sirve. Lo que llega de Firestore se trata
 * igual que lo que escribe la pantalla: una ficha rota no se dibuja ni se ofrece.
 */
export const sanearCasilla = (valor = {}) => {
  const id = texto(valor.id);
  const nivel = texto(valor.nivel);
  const nombre = limpiarNombreCasilla(valor.nombre);
  const tipo = texto(valor.tipo) || TIPOS_CASILLA.casilla;
  const idNodoPadre = texto(valor.idNodoPadre);
  const division = texto(valor.division).toLowerCase() || null;

  if (!ES_ID_CASILLA.test(id)) return null;
  if (!NIVELES_CON_CASILLAS.includes(nivel)) return null;
  if (nombre.length < LARGO_NOMBRE_CASILLA.minimo || nombre.length > LARGO_NOMBRE_CASILLA.maximo) {
    return null;
  }
  if (!Object.values(TIPOS_CASILLA).includes(tipo)) return null;
  if (!ES_ID_NODO.test(idNodoPadre)) return null;
  // La división solo existe en el destacamento (Líder de Grupo de Exploradores…).
  if (division && (nivel !== 'destacamento' || !DIVISIONES.includes(division))) return null;

  return {
    id,
    nivel,
    nombre,
    tipo,
    idNodoPadre,
    division,
    orden: Number(valor.orden) || 0,
    activo: valor.activo !== false,
  };
};

/** Las válidas (también las quitadas), en el orden en que se crearon. */
export const casillasValidas = (lista = []) =>
  (Array.isArray(lista) ? lista : [])
    .map(sanearCasilla)
    .filter(Boolean)
    .sort((a, b) => a.orden - b.orden || a.id.localeCompare(b.id));

/** Las que se dibujan y se ofrecen: las válidas que no se han quitado. */
export const casillasVigentes = (lista = []) =>
  casillasValidas(lista).filter((casilla) => casilla.activo);

/** Id del nodo del árbol (y del diseño guardado) de una casilla añadida. */
export const idNodoDeCasilla = (casilla) => `casilla-${casilla.id}`;

/** Cargo con el que el organigrama del destacamento casa su casilla. */
export const cargoDeCasillaDest = (casilla) => `casilla_${casilla.id}`;

export const esCargoDeCasillaDest = (cargo) =>
  /^casilla_c[a-z0-9]{4,20}$/.test(String(cargo || ''));

/**
 * La posición del catálogo de la casilla: la misma forma que las de fábrica
 * (`directiva-positions.js`). Un contenedor no se asigna, como "Zonas".
 */
export const posicionDeCasilla = (casilla) => ({
  idCargo: `${casilla.nivel}-casilla-${casilla.id}`,
  idCargoApi: null,
  ordenCasilla: 1,
  nivel: casilla.nivel,
  nivelOrganizacional: casilla.nivel,
  nombreCargo: casilla.nombre,
  idNodoDiagrama: idNodoDeCasilla(casilla),
  idCargoPadre: '',
  idNodoPadre: casilla.idNodoPadre,
  nombreCargoPadre: '',
  division: casilla.division || null,
  // Detrás de las de fábrica y FIJO: el `orden` entra en el id de la
  // asignación, así que no puede depender de cuántas haya (quitar una
  // renumeraría las demás y dejaría huérfanas sus asignaciones). Entre ellas
  // las ordena la lista, que llega en orden de creación.
  orden: 1000,
  tipoNodo: casilla.tipo === TIPOS_CASILLA.contenedor ? 'estructura' : 'cargo',
  // Una quitada sigue en el catálogo solo para traducir su nombre (historial,
  // lista de miembros); ni se ofrece ni se asigna.
  asignable: casilla.activo !== false && casilla.tipo === TIPOS_CASILLA.casilla,
  activo: casilla.activo !== false,
  personalizada: true,
  idCasilla: casilla.id,
});

// ----------------------------------------------------------------------
// El árbol con las casillas añadidas.
// ----------------------------------------------------------------------

const nodoDeCasilla = (casilla, hijos, { nivel }) => {
  const id = idNodoDeCasilla(casilla);

  if (casilla.tipo === TIPOS_CASILLA.contenedor) {
    // Caja de estructura: sin "Vacante" ni menú de asignar, como el Consejo
    // Ejecutivo o una división del destacamento.
    return {
      id,
      role: '',
      name: casilla.nombre,
      avatarUrl: '/watermark.webp',
      isDivision: true,
      personalizada: true,
      // Para que lo que cuelgue de él herede la división (destacamento).
      divisionDeCasilla: casilla.division || null,
      children: hijos,
    };
  }

  return {
    id,
    role: casilla.nombre,
    personalizada: true,
    children: hijos,
    // El destacamento casa cada casilla con su asignación por cargo + división.
    ...(nivel === 'destacamento' && {
      asignacionOrganigrama: {
        cargo: cargoDeCasillaDest(casilla),
        division: casilla.division || null,
        orden: 1,
      },
    }),
  };
};

/**
 * Recibe TODAS las casillas (también las quitadas, que no se dibujan pero dicen
 * dónde estaba lo que colgaba de ellas).
 *
 * Los árboles del nivel con las casillas añadidas colgando de su nodo padre
 * (que puede ser otra casilla añadida, p. ej. un contenedor). No toca los de
 * fábrica: devuelve copias.
 *
 * Una casilla cuyo padre ya no existe cuelga de la raíz del primer árbol: así
 * se sigue viendo —y se puede quitar— en vez de desaparecer sin avisar.
 */
export const arbolesConCasillas = (arboles = [], nivel, casillas = []) => {
  const lista = casillasVigentes(casillas).filter((casilla) => casilla.nivel === nivel);
  const bases = (Array.isArray(arboles) ? arboles : [arboles]).filter(Boolean);

  if (!lista.length || !bases.length) return bases;

  const idsDeFabrica = new Set();
  const recoger = (nodo) => {
    if (!nodo?.id) return;
    idsDeFabrica.add(nodo.id);
    (nodo.children || []).forEach(recoger);
  };
  bases.forEach(recoger);

  const idsAnadidos = new Set(lista.map(idNodoDeCasilla));
  const hijosPorPadre = new Map();
  // Las quitadas, por su nodo: lo que colgaba de un contenedor quitado sube al
  // sitio donde estaba él, en vez de irse a la raíz del árbol.
  const quitadasPorNodo = new Map(
    casillasValidas(casillas)
      .filter((casilla) => !casilla.activo && casilla.nivel === nivel)
      .map((casilla) => [idNodoDeCasilla(casilla), casilla])
  );
  const padreVisible = (idNodoPadre) => {
    let actual = idNodoPadre;
    const vistos = new Set();

    while (quitadasPorNodo.has(actual) && !vistos.has(actual)) {
      vistos.add(actual);
      actual = quitadasPorNodo.get(actual).idNodoPadre;
    }

    return actual;
  };

  lista.forEach((casilla) => {
    const idPadre = padreVisible(casilla.idNodoPadre);
    const padreExiste = idsDeFabrica.has(idPadre) || idsAnadidos.has(idPadre);
    const padre = padreExiste ? idPadre : bases[0].id;

    if (!hijosPorPadre.has(padre)) hijosPorPadre.set(padre, []);
    hijosPorPadre.get(padre).push(casilla);
  });

  // Un contenedor no puede colgar de sí mismo ni de un descendiente suyo.
  const construir = (casilla, visitados) => {
    const id = idNodoDeCasilla(casilla);

    if (visitados.has(id)) return null;

    const siguientes = new Set(visitados).add(id);
    const hijos = (hijosPorPadre.get(id) || [])
      .map((hija) => construir(hija, siguientes))
      .filter(Boolean);

    return nodoDeCasilla(casilla, hijos, { nivel });
  };

  const clonar = (nodo) => {
    const anadidas = (hijosPorPadre.get(nodo.id) || [])
      .map((casilla) => construir(casilla, new Set()))
      .filter(Boolean);
    const propios = Array.isArray(nodo.children) ? nodo.children.map(clonar) : [];

    if (!anadidas.length && !Array.isArray(nodo.children)) return { ...nodo };

    return { ...nodo, children: [...propios, ...anadidas] };
  };

  return bases.map(clonar);
};

/** Un solo árbol (nación, región, sección) con sus casillas añadidas. */
export const arbolConCasillas = (arbol, nivel, casillas = []) =>
  arbolesConCasillas([arbol], nivel, casillas)[0] || arbol;

/**
 * Los nodos de un árbol como opciones de "Debajo de": id, nombre y profundidad
 * para sangrarlos. Los nodos sin nombre (la caja raíz del Consejo) salen con
 * el suyo de estructura.
 */
export const nodosParaElegirPadre = (arboles = []) => {
  const opciones = [];
  const recorrer = (nodo, profundidad) => {
    if (!nodo?.id) return;

    const division =
      nodo.asignacionOrganigrama?.division ||
      nodo.divisionDeCasilla ||
      (String(nodo.id).startsWith('division-') ? String(nodo.id).slice('division-'.length) : null);
    // Una caja se nombra por su nombre y no por su rótulo: la división salía
    // como "14 a 17 años". Y un cargo de división lleva la división detrás,
    // porque "Líder de Grupo" se repetía cuatro veces sin decir de cuál era.
    const nombre = nodo.isDivision
      ? texto(nodo.name) || texto(nodo.role) || nodo.id
      : texto(nodo.role) || texto(nodo.name) || nodo.id;

    opciones.push({
      id: nodo.id,
      nombre:
        division && !nodo.isDivision
          ? `${nombre} (${NOMBRE_DIVISION[division] || division})`
          : nombre,
      profundidad,
      division,
    });

    (nodo.children || []).forEach((hijo) => recorrer(hijo, profundidad + 1));
  };

  (Array.isArray(arboles) ? arboles : [arboles]).forEach((arbol) => recorrer(arbol, 0));

  return opciones;
};
