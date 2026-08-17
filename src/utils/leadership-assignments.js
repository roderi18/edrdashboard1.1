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
  const nombre =
    [member?.nombres ?? member?.firstName, member?.apellidos ?? member?.lastName]
      .filter(Boolean)
      .join(' ')
      .trim() ||
    member?.name ||
    '';

  return {
    nombreMiembro: nombre,
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
    codigoMiembro: asignacion.codigoMiembro || '',
    avatarUrl: asignacion.fotoMiembro || '',
    soloDesdeAsignacion: true,
  };
};
