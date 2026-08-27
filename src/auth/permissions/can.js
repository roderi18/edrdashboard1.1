import { ROLES, ALCANCES } from './roles';
import { PERMISOS_POR_ROL, RESTRICCIONES_ROL } from './role-permissions';

const normalizeList = (value) =>
  Array.isArray(value)
    ? value.filter(Boolean).map((item) => String(item))
    : typeof value === 'string'
      ? [String(value)]
      : [];

export const normalizarAccesoUsuario = (entrada) => {
  // Al cerrar sesion la sesion pasa a `null` mientras la pantalla se desmonta, y
  // un valor por defecto no cubre `null`: solo `undefined`.
  const usuario = entrada ?? {};
  const rolId =
    usuario.rolId ||
    usuario.roleId ||
    usuario.rolCodigo ||
    usuario.roleCodigo ||
    usuario.memberRole ||
    usuario.rol ||
    usuario.role ||
    ROLES.USUARIO_COMUN;
  // Los permisos de TODOS sus cargos, no solo los del principal. Quien ocupa una
  // casilla en su destacamento y otra en su seccion ejerce las dos y sus
  // permisos se suman —es el modelo declarado en el catalogo de combinaciones—;
  // preguntando solo por el principal, lo que abre el otro cargo desaparecia,
  // empezando por sus botones en el menu lateral.
  const permisosDeSusCargos = (Array.isArray(usuario.cargos) ? usuario.cargos : [])
    .map((cargo) =>
      String(cargo?.rol ?? cargo?.rolId ?? cargo?.codigo ?? '')
        .trim()
        .toLowerCase()
    )
    .filter(Boolean)
    .flatMap((codigo) => PERMISOS_POR_ROL[codigo] || []);
  const permisosRol = [...(PERMISOS_POR_ROL[rolId] || []), ...permisosDeSusCargos];
  const permisosDirectos = [
    ...normalizeList(usuario.permisos),
    ...normalizeList(usuario.permissions),
    ...normalizeList(usuario.permisosRol),
    ...normalizeList(usuario.permisosDirectos),
    ...normalizeList(usuario.directPermissions),
    ...normalizeList(usuario.permisosAutorizacion),
  ];
  const permisosExcluidos = normalizeList(usuario.permisosExcluidos || usuario.excludedPermissions);
  const permisos = Array.from(new Set([...permisosRol, ...permisosDirectos])).filter(
    (permiso) => !permisosExcluidos.includes(permiso)
  );

  return {
    ...usuario,
    rolId,
    permisos,
    alcance: usuario.alcance || {},
    restricciones: {
      ...(RESTRICCIONES_ROL[rolId] || {}),
      ...(usuario.restricciones || {}),
    },
  };
};

export const can = (usuario, permiso) => {
  if (!usuario || !permiso) return false;

  const acceso = normalizarAccesoUsuario(usuario);

  return acceso.permisos.includes(permiso);
};

export const canAny = (usuario, permisos = []) => permisos.some((permiso) => can(usuario, permiso));

export const canAll = (usuario, permisos = []) => permisos.every((permiso) => can(usuario, permiso));

// Solo lectura es una propiedad del CARGO, no de la persona. Quien ocupa dos
// casillas —Coordinador en su destacamento y un cargo de consulta en su region o
// en el Consejo Nacional— entra con el de mayor nivel, y ese suele ser el de solo
// lectura: mirar unicamente el rol principal le quitaba en silencio todo lo que
// hace en su destacamento. Si ejerce ALGUN cargo que si puede modificar, no es de
// solo lectura; lo que acota sobre QUE puede es su alcance, no esta marca.
const ejerceAlgunCargoQueModifica = (usuario = {}) =>
  (Array.isArray(usuario?.cargos) ? usuario.cargos : []).some((cargo) => {
    const codigo = String(cargo?.rol ?? cargo?.rolId ?? cargo?.codigo ?? '')
      .trim()
      .toLowerCase();
    const catalogo = RESTRICCIONES_ROL[codigo];

    return Boolean(catalogo) && catalogo.soloLectura !== true;
  });

export const isReadOnlyRole = (usuario) => {
  if (ejerceAlgunCargoQueModifica(usuario)) return false;

  const acceso = normalizarAccesoUsuario(usuario);
  // El catálogo del rol MANDA para solo lectura: un rol definido como soloLectura
  // lo es aunque el token traiga una restricción heredada (soloLectura:false) de
  // una asignación anterior. Así el cambio de rol surte efecto sin necesidad de
  // re-sincronizar el token/catálogo en Firebase.
  const catalogo = RESTRICCIONES_ROL[acceso.rolId];
  return Boolean(catalogo?.soloLectura || acceso.restricciones.soloLectura);
};

export const puedeModificar = (usuario, permiso) => can(usuario, permiso) && !isReadOnlyRole(usuario);

const getResourceScopeValue = (resource = {}, keys = []) =>
  keys.map((key) => resource?.[key]).find((value) => value !== undefined && value !== null && value !== '');

const matchesScopeValue = (resourceValue, directValue, values = []) => {
  if (!resourceValue) return true;

  const allowedValues = [
    directValue,
    ...(Array.isArray(values) ? values : []),
  ]
    .filter((value) => value !== undefined && value !== null && value !== '')
    .map((value) => String(value));

  return allowedValues.includes(String(resourceValue));
};

export const estaDentroDelAlcance = (usuario, recurso = {}) => {
  const { alcance = {} } = normalizarAccesoUsuario(usuario);
  const tipo = alcance.tipo || alcance.modo || ALCANCES.DESTACAMENTO;

  if (alcance.nacional || tipo === ALCANCES.NACIONAL || tipo === ALCANCES.GLOBAL) {
    return true;
  }

  if (tipo === ALCANCES.REGION) {
    const regionId = getResourceScopeValue(recurso, ['regionId', 'idRegion', 'regionalId']);
    return matchesScopeValue(regionId, alcance.regionId || alcance.idRegion, alcance.regiones);
  }

  if (tipo === ALCANCES.SECCION) {
    const seccionId = getResourceScopeValue(recurso, ['seccionId', 'idSeccion', 'sectionalId']);
    return matchesScopeValue(seccionId, alcance.seccionId || alcance.idSeccion, alcance.secciones);
  }

  const destacamentoId = getResourceScopeValue(recurso, [
    'destacamentoId',
    'idDestacamento',
    'destId',
    'id',
  ]);

  return matchesScopeValue(
    destacamentoId,
    alcance.destacamentoId || alcance.idDestacamento,
    alcance.destacamentos
  );
};

export const esMenorDeEdad = (miembro = {}) => {
  const edad = Number(miembro.edad || miembro.age);

  if (Number.isFinite(edad) && edad > 0) {
    return edad < 18;
  }

  const fechaNacimiento = miembro.fechaNacimiento || miembro.birthDate || miembro.dateOfBirth;
  const timestamp = fechaNacimiento ? new Date(fechaNacimiento).getTime() : NaN;

  if (!Number.isFinite(timestamp)) {
    return false;
  }

  const edadCalculada = (Date.now() - timestamp) / (365.25 * 24 * 60 * 60 * 1000);

  return edadCalculada < 18;
};
