import { ROLES, ALCANCES } from './roles';
import { PERMISOS_POR_ROL, RESTRICCIONES_ROL } from './role-permissions';

const normalizeList = (value) =>
  Array.isArray(value)
    ? value.filter(Boolean).map((item) => String(item))
    : value
      ? [String(value)]
      : [];

export const normalizarAccesoUsuario = (usuario = {}) => {
  const rolId = usuario.rolId || usuario.roleId || usuario.rol || usuario.role || ROLES.USUARIO_COMUN;
  const permisosRol = PERMISOS_POR_ROL[rolId] || [];
  const permisosDirectos = normalizeList(usuario.permisos || usuario.permissions);
  const permisos = Array.from(new Set([...permisosRol, ...permisosDirectos]));

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

export const isReadOnlyRole = (usuario) => Boolean(normalizarAccesoUsuario(usuario).restricciones.soloLectura);

export const puedeModificar = (usuario, permiso) => can(usuario, permiso) && !isReadOnlyRole(usuario);

const getResourceScopeValue = (resource = {}, keys = []) =>
  keys.map((key) => resource?.[key]).find((value) => value !== undefined && value !== null && value !== '');

export const estaDentroDelAlcance = (usuario, recurso = {}) => {
  const { alcance = {} } = normalizarAccesoUsuario(usuario);
  const tipo = alcance.tipo || alcance.modo || ALCANCES.DESTACAMENTO;

  if (alcance.nacional || tipo === ALCANCES.NACIONAL || tipo === ALCANCES.GLOBAL) {
    return true;
  }

  if (tipo === ALCANCES.REGION) {
    const regionId = getResourceScopeValue(recurso, ['regionId', 'idRegion', 'regionalId']);
    return !regionId || String(regionId) === String(alcance.regionId || alcance.idRegion);
  }

  if (tipo === ALCANCES.SECCION) {
    const seccionId = getResourceScopeValue(recurso, ['seccionId', 'idSeccion', 'sectionalId']);
    return !seccionId || String(seccionId) === String(alcance.seccionId || alcance.idSeccion);
  }

  const destacamentoId = getResourceScopeValue(recurso, [
    'destacamentoId',
    'idDestacamento',
    'destId',
  ]);

  return !destacamentoId || String(destacamentoId) === String(alcance.destacamentoId || alcance.idDestacamento);
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
