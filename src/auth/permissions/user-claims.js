import { ROLES_POR_CODIGO } from './roles';
import { RESTRICCIONES_ROL, ALCANCE_PREDETERMINADO_ROL } from './role-permissions';

// ----------------------------------------------------------------------
// Derivación de los custom claims de autorización a partir de la asignación de
// rol del usuario (rolId + alcance). Estos claims viajan en el token de Firebase
// y son la fuente que consume el backend .NET para autorizar por alcance.
//
// Contrato (ver docs/seguridad-miembros-por-region.md):
//   { rol, alcanceNivel, regiones[], secciones[], destacamentos[], soloLectura }
//
// Lógica PURA (sin dependencias de red/Firebase): reutilizable por el endpoint
// server-side y por el script de backfill, y testeable de forma aislada.
// ----------------------------------------------------------------------

const normalizeId = (value) =>
  value === null || value === undefined ? '' : String(value).trim();

const toIdArray = (...values) =>
  Array.from(
    new Set(
      values
        .flat()
        .map(normalizeId)
        .filter((value) => value !== '')
    )
  );

const normalizeRolId = (rolId) => String(rolId ?? '').trim().toLowerCase();

// Nivel de alcance del rol: primero el catálogo (fuente de verdad), luego lo que
// venga marcado en el propio alcance, por robustez.
export const getAlcanceNivel = (rolId, alcance = {}) =>
  ALCANCE_PREDETERMINADO_ROL[normalizeRolId(rolId)] ||
  alcance?.tipo ||
  alcance?.modo ||
  '';

export const deriveUserClaims = ({ rolId, alcance = {} } = {}) => {
  const rol = normalizeRolId(rolId);
  const alcanceNivel = getAlcanceNivel(rol, alcance);
  const soloLectura = Boolean(RESTRICCIONES_ROL[rol]?.soloLectura);

  return {
    rol,
    alcanceNivel,
    regiones: toIdArray(alcance?.regiones, alcance?.regionId, alcance?.idRegion),
    secciones: toIdArray(alcance?.secciones, alcance?.seccionId, alcance?.idSeccion),
    destacamentos: toIdArray(
      alcance?.destacamentos,
      alcance?.destacamentoId,
      alcance?.idDestacamento
    ),
    soloLectura,
  };
};

// Roles reconocidos por el catálogo (para validar antes de setear claims).
export const isKnownRole = (rolId) => Boolean(ROLES_POR_CODIGO[normalizeRolId(rolId)]);
