import {
  doc,
  getDocs,
  writeBatch,
  collection,
  serverTimestamp,
} from 'firebase/firestore';

import { FIRESTORE, isFirebaseConfigured } from 'src/lib/firebase';

// ----------------------------------------------------------------------

export const COLECCION_CARGOS_DIRECTIVA = 'cargosDirectiva';
export const COLECCION_DIRECTIVAS_ORGANIZACIONALES = 'directivasOrganizacionales';
export const COLECCION_ASIGNACIONES_DIRECTIVA = 'asignacionesDirectiva';
export const COLECCION_DISENOS_DIRECTIVA = 'disenosDirectiva';

export const NIVELES_DIRECTIVA = {
  nacional: 'nacional',
  regional: 'regional',
  seccional: 'seccional',
  destacamento: 'destacamento',
};

export const DIVISIONES_DIRECTIVA = {
  navegantes: 'navegantes',
  pioneros: 'pioneros',
  seguidores: 'seguidores',
  exploradores: 'exploradores',
};

const NOMBRES_DIVISION = {
  [DIVISIONES_DIRECTIVA.navegantes]: 'Navegantes',
  [DIVISIONES_DIRECTIVA.pioneros]: 'Pioneros',
  [DIVISIONES_DIRECTIVA.seguidores]: 'Seguidores',
  [DIVISIONES_DIRECTIVA.exploradores]: 'Exploradores',
};

const normalizarId = (value = '') =>
  String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');

const normalizarTexto = (value = '') => String(value || '').trim();

const crearCargo = ({
  idCargo,
  nivel,
  nombreCargo,
  idNodoDiagrama,
  idCargoPadre = '',
  idNodoPadre = '',
  nombreCargoPadre = '',
  division = null,
  orden,
  tipoNodo = 'cargo',
  asignable = true,
}) => ({
  idCargo,
  nivel,
  nivelOrganizacional: nivel,
  nombreCargo,
  idNodoDiagrama: idNodoDiagrama || idCargo,
  idCargoPadre,
  idNodoPadre,
  nombreCargoPadre,
  division,
  nombreDivision: division ? NOMBRES_DIVISION[division] || '' : '',
  orden,
  tipoNodo,
  asignable,
  activo: true,
});

const crearCargoDivisionDestacamento = (division, orden) =>
  crearCargo({
    idCargo: `destacamento-division-${division}`,
    nivel: NIVELES_DIRECTIVA.destacamento,
    nombreCargo: NOMBRES_DIVISION[division],
    idNodoDiagrama: division,
    division,
    orden,
    tipoNodo: 'division',
    asignable: false,
  });

const crearCargosDivisionDestacamento = (division, ordenBase) => {
  const idCargoDivision = `destacamento-division-${division}`;
  const idCargoLider = `destacamento-${division}-lider-grupo`;

  return [
    crearCargoDivisionDestacamento(division, ordenBase),
    crearCargo({
      idCargo: idCargoLider,
      nivel: NIVELES_DIRECTIVA.destacamento,
      nombreCargo: 'Lider de Grupo',
      idNodoDiagrama: `lider-grupo-${division}`,
      idCargoPadre: idCargoDivision,
      idNodoPadre: division,
      nombreCargoPadre: NOMBRES_DIVISION[division],
      division,
      orden: ordenBase + 1,
    }),
    crearCargo({
      idCargo: `destacamento-${division}-lider-asistente-grupo`,
      nivel: NIVELES_DIRECTIVA.destacamento,
      nombreCargo: 'Lider Asistente de Grupo',
      idNodoDiagrama: `lider-asistente-grupo-${division}`,
      idCargoPadre: idCargoLider,
      idNodoPadre: `lider-grupo-${division}`,
      nombreCargoPadre: 'Lider de Grupo',
      division,
      orden: ordenBase + 2,
    }),
  ];
};

export const CARGOS_DIRECTIVA_BASE = [
  crearCargo({
    idCargo: 'nacional-asambleas-de-dios',
    nivel: NIVELES_DIRECTIVA.nacional,
    nombreCargo: 'Concilio de las Asambleas de Dios, INC.',
    idNodoDiagrama: 'asambleas-de-dios',
    orden: 1,
  }),
  crearCargo({
    idCargo: 'nacional-ministerios-infantiles',
    nivel: NIVELES_DIRECTIVA.nacional,
    nombreCargo: 'Ministerios infantiles',
    idNodoDiagrama: 'ministerios-infantiles',
    idCargoPadre: 'nacional-asambleas-de-dios',
    idNodoPadre: 'asambleas-de-dios',
    nombreCargoPadre: 'Concilio de las Asambleas de Dios, INC.',
    orden: 2,
  }),
  crearCargo({
    idCargo: 'nacional-consejo-nacional',
    nivel: NIVELES_DIRECTIVA.nacional,
    nombreCargo: 'Consejo Nacional',
    idNodoDiagrama: 'consejo-nacional',
    idCargoPadre: 'nacional-ministerios-infantiles',
    idNodoPadre: 'ministerios-infantiles',
    nombreCargoPadre: 'Ministerios infantiles',
    orden: 3,
  }),
  crearCargo({
    idCargo: 'nacional-director-nacional',
    nivel: NIVELES_DIRECTIVA.nacional,
    nombreCargo: 'Director Nacional',
    idNodoDiagrama: 'director-nacional',
    idCargoPadre: 'nacional-consejo-nacional',
    idNodoPadre: 'consejo-nacional',
    nombreCargoPadre: 'Consejo Nacional',
    orden: 4,
  }),
  crearCargo({
    idCargo: 'nacional-capellan-nacional',
    nivel: NIVELES_DIRECTIVA.nacional,
    nombreCargo: 'Capellan Nacional',
    idNodoDiagrama: 'capellan-nacional',
    idCargoPadre: 'nacional-consejo-nacional',
    idNodoPadre: 'consejo-nacional',
    nombreCargoPadre: 'Consejo Nacional',
    orden: 5,
  }),
  crearCargo({
    idCargo: 'nacional-consejo-ejecutivo',
    nivel: NIVELES_DIRECTIVA.nacional,
    nombreCargo: 'Consejo Ejecutivo',
    idNodoDiagrama: 'consejo-ejecutivo',
    idCargoPadre: 'nacional-director-nacional',
    idNodoPadre: 'director-nacional',
    nombreCargoPadre: 'Director Nacional',
    orden: 6,
  }),
  crearCargo({
    idCargo: 'nacional-coordinador-adiestramiento',
    nivel: NIVELES_DIRECTIVA.nacional,
    nombreCargo: 'Coordinador Nacional de Adiestramiento',
    idNodoDiagrama: 'coordinador-nacional-adiestramiento',
    idCargoPadre: 'nacional-consejo-ejecutivo',
    idNodoPadre: 'consejo-ejecutivo',
    nombreCargoPadre: 'Consejo Ejecutivo',
    orden: 7,
  }),
  crearCargo({
    idCargo: 'nacional-oficiales-adiestramientos-especiales',
    nivel: NIVELES_DIRECTIVA.nacional,
    nombreCargo: 'Oficiales de Adiestramientos Especiales',
    idNodoDiagrama: 'oficiales-adiestramientos-especiales',
    idCargoPadre: 'nacional-coordinador-adiestramiento',
    idNodoPadre: 'coordinador-nacional-adiestramiento',
    nombreCargoPadre: 'Coordinador Nacional de Adiestramiento',
    orden: 8,
  }),
  crearCargo({
    idCargo: 'nacional-sub-director-nacional',
    nivel: NIVELES_DIRECTIVA.nacional,
    nombreCargo: 'Sub-Director Nacional',
    idNodoDiagrama: 'sub-director-nacional',
    idCargoPadre: 'nacional-consejo-ejecutivo',
    idNodoPadre: 'consejo-ejecutivo',
    nombreCargoPadre: 'Consejo Ejecutivo',
    orden: 9,
  }),
  crearCargo({
    idCargo: 'nacional-coordinador-promocion',
    nivel: NIVELES_DIRECTIVA.nacional,
    nombreCargo: 'Coordinador Nacional de Promocion',
    idNodoDiagrama: 'coordinador-nacional-promocion',
    idCargoPadre: 'nacional-consejo-ejecutivo',
    idNodoPadre: 'consejo-ejecutivo',
    nombreCargoPadre: 'Consejo Ejecutivo',
    orden: 10,
  }),
  crearCargo({
    idCargo: 'nacional-coordinador-produccion',
    nivel: NIVELES_DIRECTIVA.nacional,
    nombreCargo: 'Coordinador Nacional de Produccion',
    idNodoDiagrama: 'coordinador-nacional-produccion',
    idCargoPadre: 'nacional-consejo-ejecutivo',
    idNodoPadre: 'consejo-ejecutivo',
    nombreCargoPadre: 'Consejo Ejecutivo',
    orden: 11,
  }),
  crearCargo({
    idCargo: 'nacional-coordinador-programa',
    nivel: NIVELES_DIRECTIVA.nacional,
    nombreCargo: 'Coordinador Nacional de Programa',
    idNodoDiagrama: 'coordinador-nacional-programa',
    idCargoPadre: 'nacional-consejo-ejecutivo',
    idNodoPadre: 'consejo-ejecutivo',
    nombreCargoPadre: 'Consejo Ejecutivo',
    orden: 12,
  }),
  crearCargo({
    idCargo: 'nacional-comites-especiales',
    nivel: NIVELES_DIRECTIVA.nacional,
    nombreCargo: 'Comites Especiales',
    idNodoDiagrama: 'comites-especiales',
    idCargoPadre: 'nacional-consejo-ejecutivo',
    idNodoPadre: 'consejo-ejecutivo',
    nombreCargoPadre: 'Consejo Ejecutivo',
    orden: 13,
  }),

  crearCargo({
    idCargo: 'regional-consejo-ejecutivo',
    nivel: NIVELES_DIRECTIVA.regional,
    nombreCargo: 'Consejo Ejecutivo',
    idNodoDiagrama: 'consejo-ejecutivo',
    orden: 1,
  }),
  crearCargo({
    idCargo: 'regional-directiva-regional',
    nivel: NIVELES_DIRECTIVA.regional,
    nombreCargo: 'Directiva Regional',
    idNodoDiagrama: 'directiva-regional',
    idCargoPadre: 'regional-consejo-ejecutivo',
    idNodoPadre: 'consejo-ejecutivo',
    nombreCargoPadre: 'Consejo Ejecutivo',
    orden: 2,
  }),
  crearCargo({
    idCargo: 'regional-capellan-regional',
    nivel: NIVELES_DIRECTIVA.regional,
    nombreCargo: 'Capellan Regional',
    idNodoDiagrama: 'capellan-regional',
    idCargoPadre: 'regional-consejo-ejecutivo',
    idNodoPadre: 'consejo-ejecutivo',
    nombreCargoPadre: 'Consejo Ejecutivo',
    orden: 3,
  }),
  crearCargo({
    idCargo: 'regional-sub-director-regional',
    nivel: NIVELES_DIRECTIVA.regional,
    nombreCargo: 'Sub-Director Regional',
    idNodoDiagrama: 'sub-director-regional',
    idCargoPadre: 'regional-directiva-regional',
    idNodoPadre: 'directiva-regional',
    nombreCargoPadre: 'Directiva Regional',
    orden: 4,
  }),
  crearCargo({
    idCargo: 'regional-coordinador-adiestramiento',
    nivel: NIVELES_DIRECTIVA.regional,
    nombreCargo: 'Coordinador de Adiestramiento',
    idNodoDiagrama: 'coordinador-adiestramiento',
    idCargoPadre: 'regional-directiva-regional',
    idNodoPadre: 'directiva-regional',
    nombreCargoPadre: 'Directiva Regional',
    orden: 5,
  }),
  crearCargo({
    idCargo: 'regional-coordinador-promocion',
    nivel: NIVELES_DIRECTIVA.regional,
    nombreCargo: 'Coordinador de Promocion',
    idNodoDiagrama: 'coordinador-promocion',
    idCargoPadre: 'regional-directiva-regional',
    idNodoPadre: 'directiva-regional',
    nombreCargoPadre: 'Directiva Regional',
    orden: 6,
  }),
  crearCargo({
    idCargo: 'regional-coordinador-produccion',
    nivel: NIVELES_DIRECTIVA.regional,
    nombreCargo: 'Coordinador de Produccion',
    idNodoDiagrama: 'coordinador-produccion',
    idCargoPadre: 'regional-directiva-regional',
    idNodoPadre: 'directiva-regional',
    nombreCargoPadre: 'Directiva Regional',
    orden: 7,
  }),
  crearCargo({
    idCargo: 'regional-coordinador-programa',
    nivel: NIVELES_DIRECTIVA.regional,
    nombreCargo: 'Coordinador de Programa',
    idNodoDiagrama: 'coordinador-programa',
    idCargoPadre: 'regional-directiva-regional',
    idNodoPadre: 'directiva-regional',
    nombreCargoPadre: 'Directiva Regional',
    orden: 8,
  }),
  crearCargo({
    idCargo: 'regional-secretario-regional',
    nivel: NIVELES_DIRECTIVA.regional,
    nombreCargo: 'Secretario Regional',
    idNodoDiagrama: 'secretario-regional',
    idCargoPadre: 'regional-directiva-regional',
    idNodoPadre: 'directiva-regional',
    nombreCargoPadre: 'Directiva Regional',
    orden: 9,
  }),

  crearCargo({
    idCargo: 'seccional-directiva-regional',
    nivel: NIVELES_DIRECTIVA.seccional,
    nombreCargo: 'Directiva Regional',
    idNodoDiagrama: 'directiva-regional',
    orden: 1,
  }),
  crearCargo({
    idCargo: 'seccional-coordinador-seccional',
    nivel: NIVELES_DIRECTIVA.seccional,
    nombreCargo: 'Coordinador Seccional',
    idNodoDiagrama: 'coordinador-seccional',
    idCargoPadre: 'seccional-directiva-regional',
    idNodoPadre: 'directiva-regional',
    nombreCargoPadre: 'Directiva Regional',
    orden: 2,
  }),
  crearCargo({
    idCargo: 'seccional-capellan-seccional',
    nivel: NIVELES_DIRECTIVA.seccional,
    nombreCargo: 'Capellan Seccional',
    idNodoDiagrama: 'capellan-seccional',
    idCargoPadre: 'seccional-directiva-regional',
    idNodoPadre: 'directiva-regional',
    nombreCargoPadre: 'Directiva Regional',
    orden: 3,
  }),
  crearCargo({
    idCargo: 'seccional-sub-coordinador-seccional',
    nivel: NIVELES_DIRECTIVA.seccional,
    nombreCargo: 'Sub-Coordinador Seccional',
    idNodoDiagrama: 'sub-coordinador-seccional',
    idCargoPadre: 'seccional-coordinador-seccional',
    idNodoPadre: 'coordinador-seccional',
    nombreCargoPadre: 'Coordinador Seccional',
    orden: 4,
  }),
  crearCargo({
    idCargo: 'seccional-coordinador-adiestramiento',
    nivel: NIVELES_DIRECTIVA.seccional,
    nombreCargo: 'Coordinador de Adiestramiento',
    idNodoDiagrama: 'coordinador-adiestramiento',
    idCargoPadre: 'seccional-coordinador-seccional',
    idNodoPadre: 'coordinador-seccional',
    nombreCargoPadre: 'Coordinador Seccional',
    orden: 5,
  }),
  crearCargo({
    idCargo: 'seccional-coordinador-promocion',
    nivel: NIVELES_DIRECTIVA.seccional,
    nombreCargo: 'Coordinador de Promocion',
    idNodoDiagrama: 'coordinador-promocion',
    idCargoPadre: 'seccional-coordinador-seccional',
    idNodoPadre: 'coordinador-seccional',
    nombreCargoPadre: 'Coordinador Seccional',
    orden: 6,
  }),
  crearCargo({
    idCargo: 'seccional-coordinador-produccion',
    nivel: NIVELES_DIRECTIVA.seccional,
    nombreCargo: 'Coordinador de Produccion',
    idNodoDiagrama: 'coordinador-produccion',
    idCargoPadre: 'seccional-coordinador-seccional',
    idNodoPadre: 'coordinador-seccional',
    nombreCargoPadre: 'Coordinador Seccional',
    orden: 7,
  }),
  crearCargo({
    idCargo: 'seccional-coordinador-programa',
    nivel: NIVELES_DIRECTIVA.seccional,
    nombreCargo: 'Coordinador de Programa',
    idNodoDiagrama: 'coordinador-programa',
    idCargoPadre: 'seccional-coordinador-seccional',
    idNodoPadre: 'coordinador-seccional',
    nombreCargoPadre: 'Coordinador Seccional',
    orden: 8,
  }),
  crearCargo({
    idCargo: 'seccional-secretario-regional',
    nivel: NIVELES_DIRECTIVA.seccional,
    nombreCargo: 'Secretario Regional',
    idNodoDiagrama: 'secretario-regional',
    idCargoPadre: 'seccional-coordinador-seccional',
    idNodoPadre: 'coordinador-seccional',
    nombreCargoPadre: 'Coordinador Seccional',
    orden: 9,
  }),
  crearCargo({
    idCargo: 'seccional-zonas',
    nivel: NIVELES_DIRECTIVA.seccional,
    nombreCargo: 'Zonas',
    idNodoDiagrama: 'zonas',
    idCargoPadre: 'seccional-coordinador-seccional',
    idNodoPadre: 'coordinador-seccional',
    nombreCargoPadre: 'Coordinador Seccional',
    orden: 10,
  }),
  crearCargo({
    idCargo: 'seccional-grupos-locales',
    nivel: NIVELES_DIRECTIVA.seccional,
    nombreCargo: 'Grupos Locales',
    idNodoDiagrama: 'grupos-locales',
    idCargoPadre: 'seccional-zonas',
    idNodoPadre: 'zonas',
    nombreCargoPadre: 'Zonas',
    orden: 11,
  }),

  crearCargo({
    idCargo: 'destacamento-pastor',
    nivel: NIVELES_DIRECTIVA.destacamento,
    nombreCargo: 'Pastor',
    idNodoDiagrama: 'pastor',
    orden: 1,
  }),
  crearCargo({
    idCargo: 'destacamento-coordinador-destacamento',
    nivel: NIVELES_DIRECTIVA.destacamento,
    nombreCargo: 'Coordinador de Destacamento',
    idNodoDiagrama: 'coordinador-destacamento',
    idCargoPadre: 'destacamento-pastor',
    idNodoPadre: 'pastor',
    nombreCargoPadre: 'Pastor',
    orden: 2,
  }),
  crearCargo({
    idCargo: 'destacamento-coordinador-asistente-destacamento',
    nivel: NIVELES_DIRECTIVA.destacamento,
    nombreCargo: 'Coordinador Asistente Destacamento',
    idNodoDiagrama: 'coordinador-asistente-destacamento',
    idCargoPadre: 'destacamento-coordinador-destacamento',
    idNodoPadre: 'coordinador-destacamento',
    nombreCargoPadre: 'Coordinador de Destacamento',
    orden: 3,
  }),
  crearCargo({
    idCargo: 'destacamento-consejo-destacamento',
    nivel: NIVELES_DIRECTIVA.destacamento,
    nombreCargo: 'Consejo Destacamento',
    idNodoDiagrama: 'consejo-destacamento',
    idCargoPadre: 'destacamento-coordinador-asistente-destacamento',
    idNodoPadre: 'coordinador-asistente-destacamento',
    nombreCargoPadre: 'Coordinador Asistente Destacamento',
    orden: 4,
  }),
  crearCargo({
    idCargo: 'destacamento-capellan',
    nivel: NIVELES_DIRECTIVA.destacamento,
    nombreCargo: 'Capellan',
    idNodoDiagrama: 'capellan',
    idCargoPadre: 'destacamento-coordinador-asistente-destacamento',
    idNodoPadre: 'coordinador-asistente-destacamento',
    nombreCargoPadre: 'Coordinador Asistente Destacamento',
    orden: 5,
  }),
  ...crearCargosDivisionDestacamento(DIVISIONES_DIRECTIVA.navegantes, 20),
  ...crearCargosDivisionDestacamento(DIVISIONES_DIRECTIVA.pioneros, 30),
  ...crearCargosDivisionDestacamento(DIVISIONES_DIRECTIVA.seguidores, 40),
  ...crearCargosDivisionDestacamento(DIVISIONES_DIRECTIVA.exploradores, 50),
];

const asegurarFirebaseDirectivas = () => {
  if (!isFirebaseConfigured || !FIRESTORE) {
    throw new Error('Firebase no esta configurado para directivas organizacionales.');
  }
};

const ordenarCargos = (cargos = []) =>
  [...cargos].sort((a, b) => {
    const nivelCompare = String(a.nivel).localeCompare(String(b.nivel));
    if (nivelCompare !== 0) return nivelCompare;

    const divisionCompare = String(a.division || '').localeCompare(String(b.division || ''));
    if (divisionCompare !== 0) return divisionCompare;

    return Number(a.orden || 0) - Number(b.orden || 0);
  });

export const crearIdDirectivaOrganizacional = ({ nivel, idEntidad }) =>
  `${normalizarId(nivel)}_${normalizarId(idEntidad || 'general')}`;

export const crearIdAsignacionDirectiva = ({
  nivel,
  idEntidad,
  idCargo,
  division = null,
  orden = 1,
}) =>
  [
    normalizarId(nivel),
    normalizarId(idEntidad || 'general'),
    normalizarId(idCargo),
    normalizarId(division || 'general'),
    normalizarId(orden || 1),
  ].join('_');

export async function guardarCatalogoCargosDirectiva(cargos = CARGOS_DIRECTIVA_BASE) {
  asegurarFirebaseDirectivas();

  const batch = writeBatch(FIRESTORE);

  cargos.forEach((cargo) => {
    const cargoRef = doc(FIRESTORE, COLECCION_CARGOS_DIRECTIVA, cargo.idCargo);

    batch.set(
      cargoRef,
      {
        ...cargo,
        fechaActualizacion: serverTimestamp(),
        fechaCreacion: serverTimestamp(),
      },
      { merge: true }
    );
  });

  await batch.commit();

  return cargos.length;
}

export async function obtenerCargosDirectiva({
  nivel = '',
  division,
  incluirInactivos = false,
  incluirNoAsignables = true,
} = {}) {
  asegurarFirebaseDirectivas();

  const snapshot = await getDocs(collection(FIRESTORE, COLECCION_CARGOS_DIRECTIVA));

  return ordenarCargos(
    snapshot.docs
      .map((documentSnapshot) => ({
        id: documentSnapshot.id,
        ...documentSnapshot.data(),
      }))
      .filter((cargo) => (nivel ? cargo.nivel === nivel : true))
      .filter((cargo) => (division === undefined ? true : cargo.division === division))
      .filter((cargo) => (incluirInactivos ? true : cargo.activo !== false))
      .filter((cargo) => (incluirNoAsignables ? true : cargo.asignable !== false))
  );
}

export async function guardarDirectivaOrganizacional({
  nivel,
  idEntidad,
  nombreEntidad = '',
  titulo = '',
  activo = true,
} = {}) {
  asegurarFirebaseDirectivas();

  const idDirectiva = crearIdDirectivaOrganizacional({ nivel, idEntidad });
  const directiva = {
    idDirectiva,
    nivel,
    nivelOrganizacional: nivel,
    idEntidad: String(idEntidad || ''),
    nombreEntidad: normalizarTexto(nombreEntidad),
    titulo: normalizarTexto(titulo || nombreEntidad),
    activo,
    fechaActualizacion: serverTimestamp(),
  };

  await writeBatch(FIRESTORE)
    .set(doc(FIRESTORE, COLECCION_DIRECTIVAS_ORGANIZACIONALES, idDirectiva), directiva, {
      merge: true,
    })
    .commit();

  return directiva;
}

export async function obtenerAsignacionesDirectiva({ nivel, idEntidad, incluirInactivas = false } = {}) {
  asegurarFirebaseDirectivas();

  const idDirectiva = crearIdDirectivaOrganizacional({ nivel, idEntidad });
  const snapshot = await getDocs(collection(FIRESTORE, COLECCION_ASIGNACIONES_DIRECTIVA));

  return snapshot.docs
    .map((documentSnapshot) => ({
      id: documentSnapshot.id,
      ...documentSnapshot.data(),
    }))
    .filter((asignacion) => asignacion.idDirectiva === idDirectiva)
    .filter((asignacion) => (incluirInactivas ? true : asignacion.activo !== false));
}

export async function guardarAsignacionDirectiva({
  nivel,
  idEntidad,
  nombreEntidad = '',
  idCargo,
  nombreCargo = '',
  idMiembro,
  idMiembros,
  codigoMiembro = '',
  nombreMiembro = '',
  division = null,
  orden = 1,
  origen = 'miembro',
  activo = true,
} = {}) {
  asegurarFirebaseDirectivas();

  const idDirectiva = crearIdDirectivaOrganizacional({ nivel, idEntidad });
  const idMiembroResolved = String(idMiembro || idMiembros || '');
  const idAsignacion = crearIdAsignacionDirectiva({
    nivel,
    idEntidad,
    idCargo,
    division,
    orden,
  });
  const asignacion = {
    idAsignacion,
    idDirectiva,
    nivel,
    nivelOrganizacional: nivel,
    idEntidad: String(idEntidad || ''),
    nombreEntidad: normalizarTexto(nombreEntidad),
    idCargo,
    nombreCargo: normalizarTexto(nombreCargo),
    idMiembro: idMiembroResolved,
    idMiembros: idMiembroResolved,
    codigoMiembro: normalizarTexto(codigoMiembro),
    nombreMiembro: normalizarTexto(nombreMiembro),
    division,
    nombreDivision: division ? NOMBRES_DIVISION[division] || '' : '',
    orden,
    origen,
    activo,
    fechaActualizacion: serverTimestamp(),
    fechaCreacion: serverTimestamp(),
  };
  const batch = writeBatch(FIRESTORE);

  batch.set(doc(FIRESTORE, COLECCION_DIRECTIVAS_ORGANIZACIONALES, idDirectiva), {
    idDirectiva,
    nivel,
    nivelOrganizacional: nivel,
    idEntidad: String(idEntidad || ''),
    nombreEntidad: normalizarTexto(nombreEntidad),
    titulo: normalizarTexto(nombreEntidad),
    activo: true,
    fechaActualizacion: serverTimestamp(),
  }, { merge: true });
  batch.set(doc(FIRESTORE, COLECCION_ASIGNACIONES_DIRECTIVA, idAsignacion), asignacion, {
    merge: true,
  });

  await batch.commit();

  return asignacion;
}
