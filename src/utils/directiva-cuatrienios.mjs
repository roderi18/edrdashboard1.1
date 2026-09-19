import { buscarPosicionPorNodo } from './leadership-assignments.js';
// Con extension explicita: este modulo se carga tambien desde `node --test`.
import { DIRECTIVA_POSITIONS } from '../catalogs/directiva-positions.js';

// ----------------------------------------------------------------------
// La Directiva Nacional, guardada por cuatrienio.
//
// Es MEMORIA: quien ocupo cada cargo de la Directiva Nacional —la nacional, la
// de cada region y la de cada seccion— en un cuatrienio. Se guarda como una foto
// fija: no cambia cuando cambia el padron, el nombre de una seccion ni la foto
// de perfil de nadie, y NO da permisos. Los permisos salen de los cargos de hoy
// (`asignacionesDirectiva`), con una sola excepcion: quien es o fue Director
// Nacional —o Comandante Nacional, su nombre antiguo— conserva los permisos de
// Director Nacional para siempre (`permanenciaDe`).
//
// Aqui vive la regla pura; Firestore la lee y la escribe
// `src/services/directiva-cuatrienios-service.js`. Plan y listado:
// `docs/directiva-por-cuatrienio.md`.
// ----------------------------------------------------------------------

export const COLECCION_CUATRIENIOS = 'directiva_cuatrienios';
export const COLECCION_INTEGRANTES = 'directiva_cuatrienios_integrantes';
export const COLECCION_PERMANENTES = 'directiva_nacional_permanentes';

// Un cuatrienio termina el mismo dia que empieza el siguiente: el 22/08/2026 ya
// es 2026-2030. Por eso `fin` es exclusivo. El fin de 2026-2030 no esta fijado
// todavia; se deja la fecha prevista, que solo sirve para saber cual es el
// vigente.
export const CUATRIENIOS = Object.freeze([
  Object.freeze({ id: '2022-2026', inicio: '2022-08-20', fin: '2026-08-22' }),
  Object.freeze({ id: '2026-2030', inicio: '2026-08-22', fin: '2030-08-22' }),
]);

export const NIVELES_CUATRIENIO = Object.freeze({
  nacional: 'nacional',
  regional: 'regional',
  seccional: 'seccional',
});

export const GRUPOS_CUATRIENIO = Object.freeze({
  directiva: 'directiva',
  oficiales: 'oficiales',
  exComandantes: 'ex_comandantes',
});

// Los ocho cargos de toda directiva, en el orden en que se leen, mas el
// Ministerio Infantil de la nacional y el "Provisional" de las casillas que
// llegan sin cargo. `nodo` es la casilla del organigrama de ese nivel: con ella
// sale el mismo `idPosicionDirectiva` que usa la directiva de hoy, y por eso el
// organigrama historico se pinta con los componentes de siempre.
//
// En la seccion el Director ocupa la casilla "Coordinador Seccional" y el
// Sub-Director la de "Sub-Coordinador": son los nombres que la organizacion usa
// hoy para esos puestos.
export const CARGOS_DIRECTIVA = Object.freeze([
  {
    id: 'director',
    orden: 1,
    nombres: {
      nacional: 'Director Nacional',
      regional: 'Director Regional',
      seccional: 'Director Seccional',
    },
    nodos: {
      nacional: 'director-nacional',
      regional: 'directiva-regional',
      seccional: 'coordinador-seccional',
    },
  },
  {
    id: 'subdirector',
    orden: 2,
    nombres: {
      nacional: 'Sub-Director Nacional',
      regional: 'Sub-Director Regional',
      seccional: 'Sub-Director Seccional',
    },
    nodos: {
      nacional: 'sub-director-nacional',
      regional: 'sub-director-regional',
      seccional: 'sub-coordinador-seccional',
    },
  },
  {
    id: 'capellan',
    orden: 3,
    nombres: {
      nacional: 'Capellán Nacional',
      regional: 'Capellán Regional',
      seccional: 'Capellán Seccional',
    },
    nodos: {
      nacional: 'capellan-nacional',
      regional: 'capellan-regional',
      seccional: 'capellan-seccional',
    },
  },
  {
    id: 'secretario',
    orden: 4,
    nombres: {
      nacional: 'Secretario Nacional',
      regional: 'Secretario Regional',
      seccional: 'Secretario Seccional',
    },
    // La nacional no tiene casilla de secretario en su organigrama: se guarda
    // igual y sale en la lista, no en el dibujo.
    nodos: { regional: 'secretario-regional', seccional: 'secretario-regional' },
  },
  {
    id: 'produccion',
    orden: 5,
    nombres: {
      nacional: 'Coordinador Nacional de Producción',
      regional: 'Coordinador de Producción',
      seccional: 'Coordinador de Producción',
    },
    nodos: {
      nacional: 'coordinador-nacional-produccion',
      regional: 'coordinador-produccion',
      seccional: 'coordinador-produccion',
    },
  },
  {
    id: 'programa',
    orden: 6,
    nombres: {
      nacional: 'Coordinador Nacional de Programa',
      regional: 'Coordinador de Programa',
      seccional: 'Coordinador de Programa',
    },
    nodos: {
      nacional: 'coordinador-nacional-programa',
      regional: 'coordinador-programa',
      seccional: 'coordinador-programa',
    },
  },
  {
    id: 'promocion',
    orden: 7,
    nombres: {
      nacional: 'Coordinador Nacional de Promoción',
      regional: 'Coordinador de Promoción',
      seccional: 'Coordinador de Promoción',
    },
    nodos: {
      nacional: 'coordinador-nacional-promocion',
      regional: 'coordinador-promocion',
      seccional: 'coordinador-promocion',
    },
  },
  {
    id: 'adiestramiento',
    orden: 8,
    nombres: {
      nacional: 'Coordinador Nacional de Adiestramiento',
      regional: 'Coordinador de Adiestramiento',
      seccional: 'Coordinador de Adiestramiento',
    },
    nodos: {
      nacional: 'coordinador-nacional-adiestramiento',
      regional: 'coordinador-adiestramiento',
      seccional: 'coordinador-adiestramiento',
    },
  },
  {
    id: 'ministerio_infantil',
    orden: 9,
    nombres: { nacional: 'Director de Ministerios Infantiles' },
    nodos: { nacional: 'ministerios-infantiles' },
  },
  {
    id: 'oficial',
    orden: 20,
    nombres: { nacional: 'Oficial de la Nacional' },
    nodos: {},
  },
  {
    id: 'ex_comandante',
    orden: 30,
    nombres: { nacional: 'Ex Comandante Nacional' },
    nodos: {},
  },
  {
    id: 'provisional',
    orden: 90,
    nombres: {
      nacional: 'Provisional',
      regional: 'Provisional',
      seccional: 'Provisional',
    },
    nodos: {},
  },
]);

const CARGO_POR_ID = new Map(CARGOS_DIRECTIVA.map((cargo) => [cargo.id, cargo]));

export const cargoPorId = (id) => CARGO_POR_ID.get(String(id || '')) || null;

// Cargos que se eligen en el editor de cada nivel. Oficial y Ex Comandante son
// grupos de la nacional, no casillas.
export const cargosDelNivel = (nivel) =>
  CARGOS_DIRECTIVA.filter(
    (cargo) => cargo.nombres[nivel] && !['oficial', 'ex_comandante'].includes(cargo.id)
  );

export const nombreDelCargo = (nivel, cargo) =>
  cargoPorId(cargo)?.nombres?.[nivel] || cargoPorId(cargo)?.nombres?.nacional || 'Cargo';

// El `idPosicionDirectiva` de la directiva de hoy para ese cargo, o null si el
// organigrama no le da casilla.
export const posicionDelCargo = (nivel, cargo) => {
  const nodo = cargoPorId(cargo)?.nodos?.[nivel];

  if (!nodo) return null;

  return buscarPosicionPorNodo(DIRECTIVA_POSITIONS, nivel, nodo)?.idCargo || null;
};

// Al reves: de una asignacion de hoy al cargo del cuatrienio. Lo usa la "foto de
// la directiva actual". Un cargo que no es de los ocho (Comites Especiales, por
// ejemplo) no se pierde: se guarda como "provisional" con su nombre de catalogo.
export const cargoDePosicion = (nivel, idPosicionDirectiva) => {
  const id = String(idPosicionDirectiva || '').trim();

  if (!id) return null;

  return (
    CARGOS_DIRECTIVA.find(
      (cargo) => cargo.nodos?.[nivel] && posicionDelCargo(nivel, cargo.id) === id
    )?.id || null
  );
};

// ----------------------------------------------------------------------
// Fechas.
// ----------------------------------------------------------------------

const aDia = (fecha) => {
  if (fecha instanceof Date) return fecha.toISOString().slice(0, 10);

  return String(fecha || '').slice(0, 10);
};

export const cuatrienioPorId = (id) =>
  CUATRIENIOS.find((cuatrienio) => cuatrienio.id === String(id || '')) || null;

// El cuatrienio que corre en esa fecha. `inicio` cuenta y `fin` no.
export const cuatrienioDeFecha = (fecha = new Date()) => {
  const dia = aDia(fecha);

  return CUATRIENIOS.find((cuatrienio) => dia >= cuatrienio.inicio && dia < cuatrienio.fin) || null;
};

export const esCuatrienioCerrado = (id, hoy = new Date()) => {
  const cuatrienio = cuatrienioPorId(id);

  return Boolean(cuatrienio) && aDia(hoy) >= cuatrienio.fin;
};

export const esCuatrienioVigente = (id, hoy = new Date()) =>
  cuatrienioDeFecha(hoy)?.id === String(id || '');

// ----------------------------------------------------------------------
// Personas y claves.
// ----------------------------------------------------------------------

// Sin tildes, sin mayusculas, sin el "Lic." de cortesia y con los espacios
// juntos: "Lic. Federico  Muñoz" y "federico munoz" son la misma persona.
export const claveDeTexto = (valor) =>
  String(valor ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\blic\.?\s+/g, '')
    .replace(/[^a-z0-9ñ]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');

export const claveDePersona = (nombres, apellidos) =>
  claveDeTexto([nombres, apellidos].filter(Boolean).join(' '));

export const nombreCompleto = ({ nombres = '', apellidos = '' } = {}) =>
  [nombres, apellidos]
    .map((parte) => String(parte || '').trim())
    .filter(Boolean)
    .join(' ');

const aSlug = (valor) => claveDeTexto(valor).replace(/\s+/g, '-') || 'sin-nombre';

// Id ESTABLE del integrante: sale de la casilla, no de la persona ni de un
// contador. Correr la importacion dos veces escribe los mismos documentos, y
// cambiar a la persona de una casilla la reemplaza en vez de sumar otra.
export const idIntegrante = ({ cuatrienio, nivel, entidad = '', grupo, cargo, persona = '' }) => {
  const partes = [cuatrienio, nivel, aSlug(entidad || nivel)];

  if (grupo && grupo !== GRUPOS_CUATRIENIO.directiva) {
    partes.push(grupo, aSlug(persona));
  } else {
    partes.push(cargo);
  }

  return partes.join('__');
};

// ----------------------------------------------------------------------
// Del listado a los integrantes.
// ----------------------------------------------------------------------

/**
 * Lo que la importacion va a escribir, sin tocar nada.
 *
 * Reglas (las del documento de la organizacion):
 *  - Casilla sin persona ("Vacante"): no se agrega.
 *  - Casilla sin cargo: cargo "provisional", que se corrige a mano despues.
 *  - Una persona, un cargo: si el nombre ya salio antes, vale la PRIMERA
 *    posicion y esta se ignora (la casilla queda vacia).
 *  - Ex comandante nacional no es una posicion: se suma aunque la persona ya
 *    tenga cargo, porque es una condicion para siempre.
 *
 * Devuelve `{ entidades, integrantes, ignorados, vacantes }`. Las entidades son
 * las regiones y secciones que el listado nombra, para crearlas si faltan.
 */
export const planDelListado = (listado = {}, cuatrienio) => {
  const integrantes = [];
  const ignorados = [];
  const entidades = [];
  let vacantes = 0;
  // clave de persona -> descripcion de su primera posicion
  const primeraPosicion = new Map();

  const describir = (nivel, entidad, nombreCargo) =>
    nivel === NIVELES_CUATRIENIO.nacional ? nombreCargo : `${nombreCargo} · ${entidad}`;

  const agregar = ({ nivel, grupo, cargo, nombres, apellidos, region = '', seccion = '' }) => {
    const nombresLimpios = String(nombres || '').trim();
    const apellidosLimpios = String(apellidos || '').trim();

    if (!nombresLimpios) {
      vacantes += 1;
      return;
    }

    const cargoValido = cargoPorId(cargo) ? cargo : 'provisional';
    const entidad = seccion || region || '';
    const clave = claveDePersona(nombresLimpios, apellidosLimpios);
    const cargoNombre = nombreDelCargo(nivel, cargoValido);
    const posicion = describir(nivel, entidad, cargoNombre);
    const esExComandante = grupo === GRUPOS_CUATRIENIO.exComandantes;

    if (!esExComandante && primeraPosicion.has(clave)) {
      ignorados.push({
        nombre: nombreCompleto({ nombres: nombresLimpios, apellidos: apellidosLimpios }),
        posicion,
        motivo: `Repetido: ya es ${primeraPosicion.get(clave)}.`,
      });
      return;
    }

    if (!esExComandante) primeraPosicion.set(clave, posicion);

    integrantes.push({
      id: idIntegrante({
        cuatrienio,
        nivel,
        entidad,
        grupo,
        cargo: cargoValido,
        persona: clave,
      }),
      cuatrienio,
      nivel,
      grupo,
      cargo: cargoValido,
      cargoNombre,
      idPosicionDirectiva: posicionDelCargo(nivel, cargoValido),
      orden: cargoPorId(cargoValido)?.orden ?? 99,
      regionNombre: region,
      seccionNombre: seccion,
      nombres: nombresLimpios,
      apellidos: apellidosLimpios,
      clavePersona: clave,
    });
  };

  const agregarDirectiva = (casillas = [], contexto) => {
    (Array.isArray(casillas) ? casillas : []).forEach(([cargo, nombres, apellidos]) =>
      agregar({ ...contexto, grupo: GRUPOS_CUATRIENIO.directiva, cargo, nombres, apellidos })
    );
  };

  const nacional = listado.nacional || {};

  agregarDirectiva(nacional.directiva, { nivel: NIVELES_CUATRIENIO.nacional });
  (nacional.oficiales || []).forEach(([nombres, apellidos]) =>
    agregar({
      nivel: NIVELES_CUATRIENIO.nacional,
      grupo: GRUPOS_CUATRIENIO.oficiales,
      cargo: 'oficial',
      nombres,
      apellidos,
    })
  );
  (nacional.exComandantes || []).forEach(([nombres, apellidos]) =>
    agregar({
      nivel: NIVELES_CUATRIENIO.nacional,
      grupo: GRUPOS_CUATRIENIO.exComandantes,
      cargo: 'ex_comandante',
      nombres,
      apellidos,
    })
  );

  (listado.regiones || []).forEach((region) => {
    entidades.push({
      nivel: NIVELES_CUATRIENIO.regional,
      nombre: region.nombre,
      alias: region.alias || [],
    });
    agregarDirectiva(region.directiva, {
      nivel: NIVELES_CUATRIENIO.regional,
      region: region.nombre,
    });

    (region.secciones || []).forEach((seccion) => {
      entidades.push({
        nivel: NIVELES_CUATRIENIO.seccional,
        nombre: seccion.nombre,
        region: region.nombre,
        alias: seccion.alias || [],
      });
      agregarDirectiva(seccion.directiva, {
        nivel: NIVELES_CUATRIENIO.seccional,
        region: region.nombre,
        seccion: seccion.nombre,
      });
    });
  });

  return { entidades, integrantes, ignorados, vacantes };
};

// Busca una entidad del padron por nombre: el del listado o uno de sus alias.
// "Región Central" y "Central" casan; "San Francisco" casa con "San Francisco de
// Macorís" solo porque el listado lo declara como alias.
export const buscarPorNombre = (filas = [], nombre, { alias = [], obtenerNombre } = {}) => {
  const quitarPrefijo = (valor) => claveDeTexto(valor).replace(/^(region|seccion) /, '');
  const buscadas = new Set([nombre, ...alias].map(quitarPrefijo).filter(Boolean));

  return (
    (Array.isArray(filas) ? filas : []).find((fila) =>
      buscadas.has(quitarPrefijo(obtenerNombre ? obtenerNombre(fila) : fila?.nombre))
    ) || null
  );
};

// ----------------------------------------------------------------------
// Lo que queda para siempre.
// ----------------------------------------------------------------------

const esDirectorNacional = (integrante) =>
  integrante?.nivel === NIVELES_CUATRIENIO.nacional && integrante?.cargo === 'director';

/**
 * Lo que una persona conserva aunque ya no tenga cargo.
 *
 *  - `directorNacional`: fue Director Nacional en algun cuatrienio.
 *  - `exComandante`: esta en el grupo de ex comandantes, o fue Director
 *    Nacional en un cuatrienio ya cerrado ("Comandante Nacional" es el nombre
 *    antiguo del cargo). Sale siempre en el Consejo Ejecutivo.
 *  - `permisosDirectorNacional`: cualquiera de las dos. Es lo UNICO de la
 *    historia que da permisos; lo aplica el servidor en `rol-por-cargo.js`.
 */
export const permanenciaDe = (integrantesDeLaPersona = [], hoy = new Date()) => {
  const filas = Array.isArray(integrantesDeLaPersona) ? integrantesDeLaPersona : [];
  const directorNacional = filas.some(esDirectorNacional);
  const exComandante = filas.some(
    (integrante) =>
      integrante?.grupo === GRUPOS_CUATRIENIO.exComandantes ||
      (esDirectorNacional(integrante) && esCuatrienioCerrado(integrante.cuatrienio, hoy))
  );

  return {
    directorNacional,
    exComandante,
    permisosDirectorNacional: directorNacional || exComandante,
  };
};

// ----------------------------------------------------------------------
// Lectura para las pantallas.
// ----------------------------------------------------------------------

const ORDEN_NIVEL = { nacional: 0, regional: 1, seccional: 2 };
const ORDEN_GRUPO = { directiva: 0, oficiales: 1, ex_comandantes: 2 };

export const compararIntegrantes = (a, b) =>
  (ORDEN_NIVEL[a?.nivel] ?? 9) - (ORDEN_NIVEL[b?.nivel] ?? 9) ||
  String(a?.regionNombre || '').localeCompare(String(b?.regionNombre || ''), 'es') ||
  String(a?.seccionNombre || '').localeCompare(String(b?.seccionNombre || ''), 'es') ||
  (ORDEN_GRUPO[a?.grupo] ?? 9) - (ORDEN_GRUPO[b?.grupo] ?? 9) ||
  (Number(a?.orden) || 99) - (Number(b?.orden) || 99) ||
  nombreCompleto(a).localeCompare(nombreCompleto(b), 'es');

// Los integrantes de una directiva concreta. La nacional no tiene entidad; la
// region y la seccion se reconocen por id y, si el id aun no esta (se cargo el
// nombre antes de que existiera en el padron), por nombre.
export const integrantesDeEntidad = (integrantes = [], { nivel, idEntidad = '', nombre = '' }) =>
  (Array.isArray(integrantes) ? integrantes : []).filter((integrante) => {
    if (integrante?.nivel !== nivel) return false;
    if (nivel === NIVELES_CUATRIENIO.nacional) return true;

    const campoId = nivel === NIVELES_CUATRIENIO.regional ? 'regionId' : 'seccionId';
    const campoNombre = nivel === NIVELES_CUATRIENIO.regional ? 'regionNombre' : 'seccionNombre';

    if (idEntidad && integrante[campoId]) return String(integrante[campoId]) === String(idEntidad);

    return Boolean(nombre) && claveDeTexto(integrante[campoNombre]) === claveDeTexto(nombre);
  });

/**
 * Quien ocupaba la casilla `nodeId` del organigrama en esa directiva, con la
 * forma que esperan los nodos de hoy (`getLeadershipNodeIdentity`). La foto es
 * la CONGELADA: nunca la del perfil de hoy.
 */
export const ocupanteHistorico = (integrantesDeLaDirectiva = [], nivel, nodeId) => {
  const posicion = buscarPosicionPorNodo(DIRECTIVA_POSITIONS, nivel, nodeId);

  if (!posicion) return null;

  const integrante = (Array.isArray(integrantesDeLaDirectiva) ? integrantesDeLaDirectiva : []).find(
    (fila) => fila?.idPosicionDirectiva && fila.idPosicionDirectiva === posicion.idCargo
  );

  if (!integrante) return null;

  const id = integrante.idMiembros ? String(integrante.idMiembros) : '';

  return {
    id,
    idMiembros: id,
    nombres: integrante.nombres || '',
    apellidos: integrante.apellidos || '',
    name: nombreCompleto(integrante),
    codigoMiembro: integrante.codigoMiembro || '',
    avatarUrl: integrante.fotoUrl || '',
    historico: true,
  };
};

// ----------------------------------------------------------------------
// Para el servidor: los cargos que da la historia.
// ----------------------------------------------------------------------

export const ORIGEN_DIRECTOR_NACIONAL_PERMANENTE = 'director-nacional-permanente';

/**
 * Las asignaciones de alguien MAS la de Director Nacional si la conserva por la
 * historia (`permanenciaDe`). Es una casilla de mentira que no se guarda en
 * ninguna parte: solo entra al calculo del rol, para que la regla viva en un
 * sitio y el resto —permisos, alcance, `rolesQueEjerce`— salga igual que para
 * el Director Nacional de hoy.
 *
 * Nada mas de la historia da permisos: quien fue Coordinador Regional en
 * 2022-2026 entra con lo que tenga hoy.
 */
export const conCargosPermanentes = (asignaciones = [], permanente = null) => {
  const lista = Array.isArray(asignaciones) ? asignaciones : [];

  if (!permanente?.permisosDirectorNacional) return lista;

  const idDirector = posicionDelCargo(NIVELES_CUATRIENIO.nacional, 'director');
  const yaLoEs = lista.some(
    (asignacion) =>
      asignacion?.activo !== false &&
      String(asignacion?.idPosicionDirectiva || asignacion?.idCargo || '') === idDirector
  );

  if (yaLoEs) return lista;

  return [
    ...lista,
    {
      nivel: NIVELES_CUATRIENIO.nacional,
      idEntidad: 'nacional',
      nombreEntidad: 'Directiva Nacional',
      idCargo: idDirector,
      idPosicionDirectiva: idDirector,
      activo: true,
      origen: ORIGEN_DIRECTOR_NACIONAL_PERMANENTE,
    },
  ];
};
