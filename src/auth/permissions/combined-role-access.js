const normalizeList = (...values) =>
  values
    .flat()
    .filter((value) => value !== null && value !== undefined && value !== '')
    .map((value) => (Number.isFinite(Number(value)) ? Number(value) : String(value)));

const uniqueList = (...values) => Array.from(new Set(normalizeList(...values)));

const getScopeType = (scope = {}, fallback = '') => scope?.tipo || scope?.modo || fallback;

/**
 * Une los alcances de todos los cargos sin cambiar el rol principal de la
 * sesión. Un alcance seccional puede seguir siendo el principal y, al mismo
 * tiempo, conservar el destacamento concreto sobre el que manda el cargo local.
 */
export const mergeCombinedRoleScope = (scope = {}, memberAccess = {}, fallbackScopeType = '') => {
  const memberScope = memberAccess?.profile?.alcance ?? {};
  const scopeType = getScopeType(scope, fallbackScopeType || getScopeType(memberScope));
  const destacamentos = uniqueList(
    scope?.destacamentos,
    scope?.destacamentoId,
    scope?.idDestacamento,
    memberScope?.destacamentos,
    memberScope?.destacamentoId,
    memberScope?.idDestacamento,
    memberAccess?.member?.idDestacamento
  );
  const secciones = uniqueList(
    scope?.secciones,
    scope?.seccionId,
    scope?.idSeccion,
    memberScope?.secciones,
    memberScope?.seccionId,
    memberScope?.idSeccion
  );
  const regiones = uniqueList(
    scope?.regiones,
    scope?.regionId,
    scope?.idRegion,
    memberScope?.regiones,
    memberScope?.regionId,
    memberScope?.idRegion
  );

  const primaryDestId =
    scope?.destacamentoId ??
    scope?.idDestacamento ??
    memberScope?.destacamentoId ??
    memberScope?.idDestacamento ??
    destacamentos[0] ??
    '';
  const primarySectionId =
    scope?.seccionId ??
    scope?.idSeccion ??
    memberScope?.seccionId ??
    memberScope?.idSeccion ??
    secciones[0] ??
    '';
  const primaryRegionId =
    scope?.regionId ??
    scope?.idRegion ??
    memberScope?.regionId ??
    memberScope?.idRegion ??
    regiones[0] ??
    '';

  return {
    ...memberScope,
    ...scope,
    ...(scopeType ? { tipo: scopeType, modo: scopeType } : {}),
    destacamentoId: primaryDestId,
    idDestacamento: scope?.idDestacamento ?? scope?.destacamentoId ?? primaryDestId,
    destacamentos,
    seccionId: primarySectionId,
    idSeccion: scope?.idSeccion ?? scope?.seccionId ?? primarySectionId,
    secciones,
    regionId: primaryRegionId,
    idRegion: scope?.idRegion ?? scope?.regionId ?? primaryRegionId,
    regiones,
  };
};

/** Los permisos de una combinación se suman; ninguno de los cargos borra al otro. */
export const mergeCombinedRolePermissions = (...permissionLists) =>
  Array.from(
    new Set(
      permissionLists
        .flat()
        .filter(
          (permission) => permission !== null && permission !== undefined && permission !== ''
        )
        .map(String)
    )
  );

/** Entidades de destacamento asignadas realmente, no las visibles por la sección. */
export const getAssignedDestIds = (assignments = [], destRoleIds = []) => {
  const localRoleIds = new Set(destRoleIds.map((roleId) => String(roleId).trim().toLowerCase()));

  return uniqueList(
    (Array.isArray(assignments) ? assignments : [])
      .filter((assignment) => {
        const roleId = String(assignment?.rol ?? assignment?.rolId ?? assignment?.codigo ?? '')
          .trim()
          .toLowerCase();

        return assignment?.nivel === 'destacamento' || localRoleIds.has(roleId);
      })
      .map(
        (assignment) =>
          assignment?.idEntidad ?? assignment?.idDestacamento ?? assignment?.destacamentoId
      )
  );
};
