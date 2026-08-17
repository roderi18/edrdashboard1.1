import { getMemberAge } from './member-age';

// ----------------------------------------------------------------------
// Opciones del desplegable "Asignar / Cambiar miembro" de la Directiva.
//
// Cada nivel ofrece SOLO a los miembros que le pertenecen:
//   - destacamento : los del propio destacamento.
//   - seccion      : los de la seccion, mayores de edad, con su destacamento debajo.
//   - region       : los de la region, mayores de edad, con destacamento y seccion.
//
// Quien ya ocupa un cargo aparece AL FINAL, deshabilitado y con el cargo que
// tiene: sigue siendo visible (para saber por que no se puede elegir) pero no
// seleccionable.
// ----------------------------------------------------------------------

// Los cargos de seccion y region son de supervision: los ocupan adultos.
export const EDAD_MINIMA_CARGO_SUPERVISION = 18;

const normalizeId = (value) => String(value ?? '').trim();

// El directorio devuelve `nombres`/`apellidos`; otras fuentes, `firstName`/
// `lastName` o `fullName`. Se contemplan las tres, como hacen las vistas.
export const getLeadershipMemberName = (member = {}) =>
  [member?.nombres ?? member?.firstName, member?.apellidos ?? member?.lastName]
    .filter(Boolean)
    .join(' ')
    .trim() ||
  member?.fullName ||
  member?.name ||
  member?.displayName ||
  member?.codigoMiembro ||
  member?.memberId ||
  '';

const getDestIdOf = (member = {}) =>
  normalizeId(member?.idDestacamento ?? member?.destId ?? member?.destacamentoId);

const getDestOwnIds = (dest = {}) =>
  [dest?.id, dest?.idDestacamento, dest?.destId].filter(Boolean).map(normalizeId);

const getDestChurchId = (dest = {}) => normalizeId(dest?.idIglesia ?? dest?.churchId);

const getChurchOwnIds = (church = {}) =>
  [church?.idIglesia, church?.id, church?.churchId].filter(Boolean).map(normalizeId);

const getChurchSectionId = (church = {}) =>
  normalizeId(church?.idSeccion ?? church?.seccionId ?? church?.sectionId ?? church?.sectionalId);

const getSectionalOwnIds = (sectional = {}) =>
  [sectional?.idSeccion, sectional?.id, sectional?.sectionalId].filter(Boolean).map(normalizeId);

const getSectionalRegionId = (sectional = {}) =>
  normalizeId(sectional?.idRegion ?? sectional?.regionalId ?? sectional?.regionId);

const getDestName = (dest = {}) =>
  String(dest?.nombre ?? dest?.name ?? '').trim() || 'Destacamento desconocido';

const getSectionalName = (sectional = {}) =>
  String(sectional?.nombre ?? sectional?.sectionalName ?? sectional?.name ?? '').trim() ||
  'Sección desconocida';

// Indice destacamento -> seccion -> region, resuelto una sola vez por render.
// La cadena real es destacamento -> iglesia -> seccion -> region.
export const buildOrgIndex = ({ dests = [], churches = [], sectionals = [] } = {}) => {
  const sectionIdByChurchId = new Map();
  churches.forEach((church) => {
    const sectionId = getChurchSectionId(church);
    if (!sectionId) return;
    getChurchOwnIds(church).forEach((churchId) => sectionIdByChurchId.set(churchId, sectionId));
  });

  const sectionalById = new Map();
  const regionIdBySectionId = new Map();
  sectionals.forEach((sectional) => {
    const regionId = getSectionalRegionId(sectional);
    getSectionalOwnIds(sectional).forEach((sectionId) => {
      sectionalById.set(sectionId, sectional);
      if (regionId) regionIdBySectionId.set(sectionId, regionId);
    });
  });

  const destById = new Map();
  const sectionIdByDestId = new Map();
  dests.forEach((dest) => {
    const sectionId =
      normalizeId(dest?.sectionalId ?? dest?.idSeccion ?? dest?.seccionId) ||
      sectionIdByChurchId.get(getDestChurchId(dest)) ||
      '';

    getDestOwnIds(dest).forEach((destId) => {
      destById.set(destId, dest);
      if (sectionId) sectionIdByDestId.set(destId, sectionId);
    });
  });

  return { destById, sectionalById, sectionIdByDestId, regionIdBySectionId };
};

// Destacamento, seccion y region a los que pertenece un miembro.
export const getMemberOrgPath = (member, index) => {
  const destId = getDestIdOf(member);
  const dest = index.destById.get(destId) || null;
  const sectionId = index.sectionIdByDestId.get(destId) || '';
  const sectional = sectionId ? index.sectionalById.get(sectionId) || null : null;
  const regionId = sectionId ? index.regionIdBySectionId.get(sectionId) || '' : '';

  return { destId, dest, sectionId, sectional, regionId };
};

// ¿El miembro pertenece a la entidad para la que se esta asignando el cargo?
const perteneceAlAmbito = ({ nivel, idEntidad, path }) => {
  const entidad = normalizeId(idEntidad);

  if (!entidad) return false;
  if (nivel === 'destacamento') return path.destId === entidad;
  if (nivel === 'seccional') return path.sectionId === entidad;
  if (nivel === 'regional') return path.regionId === entidad;

  // Nivel nacional: cualquier miembro de la organizacion.
  return true;
};

// Texto bajo el nombre: en seccion se indica el destacamento; en region, el
// destacamento y la seccion. En destacamento basta el codigo de miembro.
const buildSubtitulo = ({ nivel, member, path }) => {
  if (nivel === 'seccional') {
    return getDestName(path.dest);
  }

  if (nivel === 'regional' || nivel === 'nacional') {
    return [getDestName(path.dest), getSectionalName(path.sectional)].join(' · ');
  }

  return (
    member?.codigoMiembro ||
    member?.memberId ||
    (member?.id || member?.idMiembros ? `ID ${member.id ?? member.idMiembros}` : '')
  );
};

// Texto bajo el titulo del dialogo: aclara DE DONDE salen los miembros que se
// estan ofreciendo, para que quede claro por que la lista es corta.
export const getLeadershipScopeLabel = ({ nivel, nombreEntidad = '' } = {}) => {
  const nombre = String(nombreEntidad || '').trim();

  if (nivel === 'destacamento') {
    return `Pertenecientes al destacamento${nombre ? ` ${nombre}` : ''}`;
  }

  if (nivel === 'seccional') {
    return `Pertenecientes a la sección${nombre ? ` ${nombre}` : ''}, mayores de edad`;
  }

  if (nivel === 'regional') {
    return `Pertenecientes a la región${nombre ? ` ${nombre}` : ''}, mayores de edad`;
  }

  return 'Pertenecientes al Consejo Nacional';
};

/**
 * Opciones del desplegable, ya filtradas y ordenadas.
 *
 * @param ocupantesPorMiembro Map/objeto idMiembro -> nombre del cargo que ocupa.
 *   Quien aparezca ahi se muestra al final, deshabilitado.
 */
export const buildLeadershipMemberOptions = ({
  members = [],
  nivel,
  idEntidad,
  index,
  ocupantesPorMiembro = new Map(),
  edadMinima = nivel === 'destacamento' ? 0 : EDAD_MINIMA_CARGO_SUPERVISION,
  idMiembroActual = null,
} = {}) => {
  const ocupantes =
    ocupantesPorMiembro instanceof Map
      ? ocupantesPorMiembro
      : new Map(Object.entries(ocupantesPorMiembro || {}));

  const opciones = members
    .map((member) => {
      const path = getMemberOrgPath(member, index);

      if (!perteneceAlAmbito({ nivel, idEntidad, path })) return null;

      const edad = getMemberAge(member);

      // La edad solo excluye cuando se conoce: sin fecha de nacimiento no se
      // descarta a nadie, se deja que lo decida quien asigna.
      if (edadMinima && edad !== null && edad < edadMinima) return null;

      const id = normalizeId(member?.id ?? member?.idMiembros);
      // Quien ya ocupa ESTE puesto no se marca como ocupado: es el valor actual.
      const rolActual =
        id && String(id) !== String(idMiembroActual ?? '') ? ocupantes.get(id) || '' : '';

      return {
        member,
        id,
        nombre: getLeadershipMemberName(member) || `Miembro ${id}`,
        subtitulo: buildSubtitulo({ nivel, member, path }),
        rolActual,
        disabled: Boolean(rolActual),
      };
    })
    .filter(Boolean);

  // Libres primero (alfabetico); los que ya tienen cargo, al final.
  return opciones.sort((a, b) => {
    if (a.disabled !== b.disabled) return a.disabled ? 1 : -1;
    return a.nombre.localeCompare(b.nombre, 'es');
  });
};
