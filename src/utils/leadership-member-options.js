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

// CON EL NUMERO cuando lo hay: "Tribu de Judá" a secas no distingue un
// destacamento de otro que se llame igual, que es justo lo que el numero
// resuelve. Es tambien como se nombran en la lista de miembros.
const getDestName = (dest = {}) => {
  const nombre = String(dest?.nombre ?? dest?.name ?? dest?.destName ?? '').trim();
  const numero = String(dest?.destNumber ?? dest?.numero ?? dest?.number ?? '').trim();

  return [nombre, numero].filter(Boolean).join(' ') || 'Destacamento desconocido';
};

const getSectionalName = (sectional = {}) =>
  String(sectional?.nombre ?? sectional?.sectionalName ?? sectional?.name ?? '').trim() ||
  'Sección desconocida';

// Indice destacamento -> seccion -> region, resuelto una sola vez por render.
// La cadena real es destacamento -> iglesia -> seccion -> region.
const getRegionalOwnIds = (regional = {}) =>
  [regional?.idRegion, regional?.id, regional?.regionId].filter(Boolean).map(normalizeId);

const getRegionalName = (regional = {}) =>
  String(regional?.nombre ?? regional?.name ?? '').trim() || 'Región desconocida';

export const buildOrgIndex = ({
  dests = [],
  churches = [],
  sectionals = [],
  // Las regiones se indexan para poder nombrarlas bajo el miembro en la Directiva
  // nacional, donde conviene saber de donde viene cada persona.
  regionals = [],
} = {}) => {
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

  const regionalById = new Map();
  regionals.forEach((regional) => {
    getRegionalOwnIds(regional).forEach((regionId) => regionalById.set(regionId, regional));
  });

  return { destById, sectionalById, sectionIdByDestId, regionIdBySectionId, regionalById };
};

// Los nombres de region y seccion suelen traer ya la palabra ("Región Este"),
// asi que anteponerla otra vez daria "Región Región Este".
const conPrefijo = (prefijo, nombre) => {
  const limpio = String(nombre || '').trim();

  if (!limpio) return '';

  return limpio.toLowerCase().startsWith(prefijo.toLowerCase()) ? limpio : `${prefijo} ${limpio}`;
};

/**
 * A QUE entidad pertenece una directiva: "Región Central", "Sección Este
 * Oriental I", "Tribu de Judá". Decir solo "una directiva regional" obliga a ir
 * a buscar de cual se trata.
 */
export const getEntidadDirectivaNombre = ({ nivel, idEntidad, index, nombreEntidad } = {}) => {
  // Los cargos del nivel nacional son los del CONSEJO EJECUTIVO: es el cuerpo
  // que los ocupa, y asi se nombra tambien en la lista de directivas.
  if (nivel === 'nacional') return 'el Consejo Ejecutivo';

  // Quien ya tiene el nombre a mano lo pasa y se ahorra el indice.
  const dado = String(nombreEntidad || '').trim();

  if (dado) {
    return nivel === 'regional'
      ? conPrefijo('Región', dado)
      : (nivel === 'seccional' && conPrefijo('Sección', dado)) || dado;
  }

  const id = normalizeId(idEntidad);

  if (nivel === 'regional') {
    const regional = index?.regionalById?.get(id);

    return conPrefijo('Región', regional ? getRegionalName(regional) : '') || 'una región';
  }

  if (nivel === 'seccional') {
    const sectional = index?.sectionalById?.get(id);

    return conPrefijo('Sección', sectional ? getSectionalName(sectional) : '') || 'una sección';
  }

  if (nivel === 'destacamento') {
    const dest = index?.destById?.get(id);

    return dest ? getDestName(dest) : 'un destacamento';
  }

  return 'otra directiva';
};

// Con su articulo, para poder pegarlo detras de "en": "en la Región Central".
const conArticulo = (nivel, entidad) => {
  if (nivel === 'nacional') return entidad;
  if (nivel === 'destacamento') return `el destacamento ${entidad}`;

  return `la ${entidad}`;
};

/** "Coordinador de Adiestramiento en la Región Central". */
export const describirCargoDeDirectiva = ({
  nombreCargo,
  nivel,
  idEntidad,
  index,
  nombreEntidad,
} = {}) => {
  const cargo = String(nombreCargo || '').trim() || 'un cargo';
  const entidad = getEntidadDirectivaNombre({ nivel, idEntidad, index, nombreEntidad });

  return `${cargo} en ${conArticulo(nivel, entidad)}`;
};

// Destacamento, seccion y region a los que pertenece un miembro.
export const getMemberOrgPath = (member, index) => {
  const destId = getDestIdOf(member);
  const dest = index.destById.get(destId) || null;
  const sectionId = index.sectionIdByDestId.get(destId) || '';
  const sectional = sectionId ? index.sectionalById.get(sectionId) || null : null;
  const regionId = sectionId ? index.regionIdBySectionId.get(sectionId) || '' : '';
  const regional = regionId ? index.regionalById?.get(regionId) || null : null;

  return { destId, dest, sectionId, sectional, regionId, regional };
};

// ¿El miembro pertenece a la entidad para la que se esta asignando el cargo?
const perteneceAlAmbito = ({ nivel, idEntidad, path }) => {
  // NACIONAL PRIMERO, antes de exigir entidad: la Directiva nacional se nutre de
  // toda la organizacion, asi que no hay entidad contra la que comparar. La vista
  // nacional no pasa `idEntidad`, y con la comprobacion de entidad por delante el
  // desplegable se quedaba VACIO: se descartaba a todo el mundo.
  if (nivel === 'nacional') return true;

  const entidad = normalizeId(idEntidad);

  if (!entidad) return false;
  if (nivel === 'destacamento') return path.destId === entidad;
  if (nivel === 'seccional') return path.sectionId === entidad;
  if (nivel === 'regional') return path.regionId === entidad;

  return false;
};

// Texto bajo el nombre: en seccion se indica el destacamento; en region, el
// destacamento y la seccion. En destacamento basta el codigo de miembro.
const buildSubtitulo = ({ nivel, member, path }) => {
  if (nivel === 'seccional') {
    return getDestName(path.dest);
  }

  // En la Directiva NACIONAL se ofrece a toda la organizacion, asi que hace falta
  // situar a cada persona: region, seccion y destacamento.
  if (nivel === 'nacional') {
    return [getRegionalName(path.regional), getSectionalName(path.sectional), getDestName(path.dest)]
      .filter(Boolean)
      .join(' · ');
  }

  if (nivel === 'regional') {
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

  return 'Pertenecientes al Consejo Ejecutivo';
};

/**
 * Opciones del desplegable, ya filtradas y ordenadas.
 *
 * @param ocupantesPorMiembro Map/objeto idMiembro -> cargo que ocupa en ESTA
 *   directiva. Se muestra al final de la lista, pero se puede elegir: al hacerlo
 *   se pregunta si de verdad se le cambia de cargo.
 * @param ocupantesEnOtroConsejo Map/objeto idMiembro -> cargo que ocupa en OTRO
 *   consejo. Se puede elegir: al hacerlo se pregunta si de verdad se le quita de
 *   alli. Solo se avisa, no se bloquea.
 */
export const buildLeadershipMemberOptions = ({
  members = [],
  nivel,
  idEntidad,
  index,
  ocupantesPorMiembro = new Map(),
  ocupantesEnOtroConsejo = new Map(),
  edadMinima = nivel === 'destacamento' ? 0 : EDAD_MINIMA_CARGO_SUPERVISION,
  idMiembroActual = null,
} = {}) => {
  const ocupantes =
    ocupantesPorMiembro instanceof Map
      ? ocupantesPorMiembro
      : new Map(Object.entries(ocupantesPorMiembro || {}));
  const ocupantesExternos =
    ocupantesEnOtroConsejo instanceof Map
      ? ocupantesEnOtroConsejo
      : new Map(Object.entries(ocupantesEnOtroConsejo || {}));

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
      // Cargo en otro consejo: se ve, pero no impide elegir.
      const rolEnOtroConsejo =
        id && String(id) !== String(idMiembroActual ?? '') ? ocupantesExternos.get(id) || '' : '';

      return {
        member,
        id,
        nombre: getLeadershipMemberName(member) || `Miembro ${id}`,
        subtitulo: buildSubtitulo({ nivel, member, path }),
        rolActual,
        rolEnOtroConsejo,
        // NADIE sale bloqueado. Deshabilitar la opcion dejaba sin salida: no
        // habia forma de mover a alguien de un cargo a otro desde el
        // organigrama, y quien mira no sabia por que no podia elegirlo. Ahora se
        // elige y se pregunta antes de quitarle el cargo que ya tiene.
        disabled: false,
      };
    })
    .filter(Boolean);

  // Libres primero (alfabetico); los que ya tienen cargo, al final.
  return opciones.sort((a, b) => {
    const aOcupado = Boolean(a.rolActual || a.rolEnOtroConsejo);
    const bOcupado = Boolean(b.rolActual || b.rolEnOtroConsejo);

    if (aOcupado !== bOcupado) return aOcupado ? 1 : -1;
    return a.nombre.localeCompare(b.nombre, 'es');
  });
};
