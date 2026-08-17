// ----------------------------------------------------------------------
// Logica pura de las asignaciones de directiva.
//
// Vive fuera del hook a proposito: sin esto, indexar y resolver asignaciones
// solo se podia ejercitar montando un componente de React, y el fallo del
// cambio de miembro en Seccion no era comprobable. Aqui se prueba con
// `node --test tests/directivas/`.
// ----------------------------------------------------------------------

export const normalizarIdAsignacion = (value) => String(value ?? '').trim();

// Los ids de nodo de los diagramas y los del catalogo describen lo mismo pero no
// siempre se escriben igual ("sub-director-regional" frente a
// "subdirector-regional"), asi que se comparan sin guiones ni acentos.
export const claveNodo = (value) =>
  String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');

// Las fechas llegan como Timestamp de Firestore, pero una asignacion sembrada a
// mano puede traer una cadena ISO o un numero.
export const aMilisegundos = (value) => {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.seconds === 'number') return value.seconds * 1000;
  if (typeof value === 'number') return value;

  const time = new Date(value).getTime();

  return Number.isFinite(time) ? time : 0;
};

// Posicion del catalogo que corresponde a un nodo del diagrama.
export const buscarPosicionPorNodo = (posiciones = [], nivel, nodeId) => {
  const key = claveNodo(nodeId);

  if (!key) return null;

  return (
    posiciones.find(
      (position) =>
        position.nivel === nivel &&
        (claveNodo(position.idNodoDiagrama) === key || claveNodo(position.idCargo) === key)
    ) || null
  );
};

// Indexa las asignaciones por posicion. Si una posicion arrastra mas de una
// asignacion activa (datos anteriores a que se diera de baja al ocupante
// saliente), gana la mas reciente y no la que ordene ultima por id de documento,
// que es el orden en el que Firestore devuelve una coleccion.
export const indexarAsignacionesPorPosicion = (filas = []) =>
  filas.reduce((acc, asignacion) => {
    const key = normalizarIdAsignacion(asignacion?.idPosicionDirectiva);

    if (!key) return acc;

    const actual = acc[key];

    if (
      !actual ||
      aMilisegundos(asignacion.fechaActualizacion) >= aMilisegundos(actual.fechaActualizacion)
    ) {
      acc[key] = asignacion;
    }

    return acc;
  }, {});

// Datos del miembro que se guardan DENTRO de la asignacion. Sin esta copia, un
// ocupante que no venga en el listado de miembros (baja, filtro, paginacion)
// dejaba el nodo en blanco aunque la asignacion existiera.
export const construirResumenMiembro = (member = {}) => {
  const nombres = String(member?.nombres ?? member?.firstName ?? '').trim();
  const apellidos = String(member?.apellidos ?? member?.lastName ?? '').trim();
  const nombre = [nombres, apellidos].filter(Boolean).join(' ').trim() || member?.name || '';

  return {
    nombreMiembro: nombre,
    // Nombres y apellidos se guardan TAMBIEN por separado: el organigrama
    // abrevia el nombre y con la cadena entera no se puede saber donde acaban
    // los nombres y empiezan los apellidos.
    nombresMiembro: nombres,
    apellidosMiembro: apellidos,
    codigoMiembro: String(member?.codigoMiembro ?? member?.memberCode ?? '').trim(),
    fotoMiembro: String(member?.avatarUrl ?? member?.photoURL ?? '').trim(),
  };
};

// Miembro que ocupa una posicion. Se resuelve contra el listado de miembros y,
// si ahi no aparece, contra la copia guardada en la propia asignacion.
export const resolverMiembroAsignado = ({ asignacion, members = [] }) => {
  if (!asignacion?.idMiembro) return null;

  const idMiembro = normalizarIdAsignacion(asignacion.idMiembro);
  const member = members.find(
    (item) => normalizarIdAsignacion(item?.id ?? item?.idMiembros) === idMiembro
  );

  if (member) return member;

  if (!asignacion.nombreMiembro && !asignacion.codigoMiembro) return null;

  return {
    id: idMiembro,
    idMiembros: idMiembro,
    name: asignacion.nombreMiembro || '',
    nombres: asignacion.nombresMiembro || '',
    apellidos: asignacion.apellidosMiembro || '',
    codigoMiembro: asignacion.codigoMiembro || '',
    avatarUrl: asignacion.fotoMiembro || '',
    soloDesdeAsignacion: true,
  };
};

// Nombre COMPLETO del miembro, tal como se registro.
export const getNombreCompletoMiembro = (member = {}) =>
  [member?.nombres ?? member?.firstName, member?.apellidos ?? member?.lastName]
    .filter(Boolean)
    .join(' ')
    .trim() ||
  member?.name ||
  member?.codigoMiembro ||
  '';

// Partículas que forman parte del apellido: "De los Santos" es un apellido, no
// tres, y quedarse con "De" no identifica a nadie.
const PARTICULAS_APELLIDO = ['de', 'del', 'la', 'las', 'los', 'da', 'di', 'van', 'von'];

const partirPalabras = (value) => String(value ?? '').trim().split(/\s+/).filter(Boolean);

// Primer apellido, respetando las partículas que lo acompañan.
const getPrimerApellido = (palabras = []) => {
  if (!palabras.length) return '';

  const primerApellido = [palabras[0]];
  let indice = 1;

  while (
    indice < palabras.length &&
    PARTICULAS_APELLIDO.includes(primerApellido[primerApellido.length - 1].toLowerCase())
  ) {
    primerApellido.push(palabras[indice]);
    indice += 1;
  }

  return primerApellido.join(' ');
};

// Nombre ABREVIADO para las tarjetas del organigrama: primer nombre, inicial del
// segundo si lo hay, y primer apellido. "Mario Alejandro Peña Felix" se muestra
// como "Mario A. Peña", que cabe en la tarjeta sin recortarse.
export const getLeadershipShortName = (member = {}) => {
  const nombres = partirPalabras(member?.nombres ?? member?.firstName);
  let apellidos = partirPalabras(member?.apellidos ?? member?.lastName);
  let primerNombre = nombres[0] || '';
  let segundoNombre = nombres[1] || '';

  // Sin los campos separados solo queda la cadena completa. Se asume la forma
  // más habitual del registro: dos nombres y dos apellidos.
  if (!primerNombre && !apellidos.length) {
    const palabras = partirPalabras(member?.name);

    if (palabras.length >= 4) {
      [primerNombre, segundoNombre] = palabras;
      apellidos = palabras.slice(2);
    } else {
      [primerNombre] = palabras;
      apellidos = palabras.slice(1);
    }
  }

  const primerApellido = getPrimerApellido(apellidos);

  if (!primerNombre) {
    return primerApellido || getNombreCompletoMiembro(member);
  }

  // La inicial acompaña al apellido; sin apellido, "Mario A." se lee peor que
  // "Mario".
  const inicial = primerApellido && segundoNombre ? `${segundoNombre.charAt(0).toUpperCase()}.` : '';

  return [primerNombre, inicial, primerApellido].filter(Boolean).join(' ');
};
