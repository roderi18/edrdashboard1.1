import test from 'node:test';
import assert from 'node:assert/strict';

// Se prueba la REGLA, no el modulo entero: `member-access` arrastra Firebase y no
// se puede importar en una prueba suelta. La logica replicada aqui es la misma de
// `nivelDeSusCargosSobreElDestacamento` + `filterMembersByMemberScope`: manda el
// nivel MAS AMPLIO de sus cargos, y cada nivel abarca lo suyo entero.
const NIVELES = ['seccion', 'region', 'nacional'];

const ALCANCE_DE_ROL = {
  usuario_comun: 'destacamento',
  usuario_destacamento: 'destacamento',
  lider_grupo: 'destacamento',
  usuario_seccion: 'seccion',
  capellan_seccional: 'seccion',
  zonas: 'seccion',
  usuario_destacamento_asistente: 'destacamento',
  lider_grupo: 'destacamento',
  usuario_region: 'region',
  usuario_region_asistente: 'region',
  secretario_regional: 'region',
  consejo_nacional: 'nacional',
  consejo_ejecutivo: 'nacional',
};

const cargosQueEjerce = (user) =>
  [user.rolId, ...(user.cargos ?? []).map((cargo) => cargo.rol)].filter(Boolean);

const nivelDeSusCargos = (user) =>
  cargosQueEjerce(user)
    .reduce((masAmplio, codigo) => {
      const nivel = ALCANCE_DE_ROL[codigo];

      return NIVELES.indexOf(nivel) > NIVELES.indexOf(masAmplio) ? nivel : masAmplio;
    }, '');

const SECCION_DE_DEST = { 231: 'A', 233: 'A', 240: 'B', 310: 'C' };
const REGION_DE_SECCION = { A: 'R1', B: 'R1', C: 'R2' };

const MIEMBROS = [
  { id: 326, nombre: 'Roderi', idDestacamento: 231 },
  { id: 340, nombre: 'Daniel', idDestacamento: 233 },
  { id: 323, nombre: 'Stalin', idDestacamento: 240 },
  { id: 411, nombre: 'Ana', idDestacamento: 310 },
];

const conUbicacion = (miembro) => {
  const seccion = SECCION_DE_DEST[miembro.idDestacamento] ?? '';

  return { ...miembro, idSeccion: seccion, idRegion: REGION_DE_SECCION[seccion] ?? '' };
};

const filtrar = (user) => {
  const nivel = nivelDeSusCargos(user);
  const miembros = MIEMBROS.map(conUbicacion);
  const esSuFicha = (miembro) => String(miembro.id) === String(user.idMiembros ?? '');

  if (nivel === 'nacional') return miembros;

  if (nivel === 'region') {
    return miembros.filter((m) => esSuFicha(m) || user.regiones.includes(m.idRegion));
  }

  if (nivel === 'seccion') {
    return miembros.filter((m) => esSuFicha(m) || user.secciones.includes(m.idSeccion));
  }

  return miembros.filter((m) => esSuFicha(m) || String(m.idDestacamento) === String(user.idDestacamento));
};

const nombres = (user) => filtrar(user).map((m) => m.nombre);

test('un cargo de seccion ve los destacamentos de TODA su seccion', () => {
  const coordinadorSeccional = { rolId: 'usuario_seccion', idMiembros: 326, secciones: ['A'] };

  assert.deepEqual(nombres(coordinadorSeccional), ['Roderi', 'Daniel']);
});

test('pero no los de otra seccion de su misma region', () => {
  const coordinadorSeccional = { rolId: 'usuario_seccion', idMiembros: 326, secciones: ['A'] };

  assert.equal(nombres(coordinadorSeccional).includes('Stalin'), false);
});

test('un cargo de region ve los destacamentos de TODA su region', () => {
  const coordinadorRegional = { rolId: 'usuario_region', idMiembros: 326, regiones: ['R1'] };

  assert.deepEqual(nombres(coordinadorRegional), ['Roderi', 'Daniel', 'Stalin']);
});

test('y no los de otra region', () => {
  const coordinadorRegional = { rolId: 'usuario_region', idMiembros: 326, regiones: ['R1'] };

  assert.equal(nombres(coordinadorRegional).includes('Ana'), false);
});

test('un cargo de consulta seccional va con los de nivel seccion', () => {
  const capellanSeccional = { rolId: 'capellan_seccional', idMiembros: 326, secciones: ['A'] };

  assert.deepEqual(nombres(capellanSeccional), ['Roderi', 'Daniel']);
});

test('el Consejo Nacional y el Ejecutivo ven el pais entero', () => {
  const consejoNacional = { rolId: 'consejo_nacional', idMiembros: 326 };
  const consejoEjecutivo = { rolId: 'consejo_ejecutivo', idMiembros: 326 };

  assert.equal(nombres(consejoNacional).length, MIEMBROS.length);
  assert.equal(nombres(consejoEjecutivo).length, MIEMBROS.length);
});

test('sin cargo por encima del destacamento se sigue viendo solo el suyo', () => {
  const coordinadorDestacamento = {
    rolId: 'usuario_destacamento',
    idMiembros: 326,
    idDestacamento: 231,
  };

  assert.deepEqual(nombres(coordinadorDestacamento), ['Roderi']);
});

// Manda el nivel mas amplio de TODOS sus cargos, no el principal: quien coordina
// su destacamento y ademas ocupa una casilla en la seccion mira a los de toda la
// seccion.
test('el cargo de seccion se suma al de destacamento y abre la seccion entera', () => {
  const combinado = {
    rolId: 'usuario_destacamento',
    idMiembros: 326,
    idDestacamento: 231,
    secciones: ['A'],
    cargos: [
      { rol: 'usuario_destacamento', nivel: 'destacamento', idEntidad: 231 },
      { rol: 'capellan_seccional', nivel: 'seccional', idEntidad: 'A' },
    ],
  };

  assert.deepEqual(nombres(combinado), ['Roderi', 'Daniel']);
});

test('su propia ficha aparece aunque su destacamento quede fuera del alcance', () => {
  const seccionalDeOtraSeccion = { rolId: 'usuario_seccion', idMiembros: 411, secciones: ['A'] };

  assert.equal(nombres(seccionalDeOtraSeccion).includes('Ana'), true);
});

// --- La ESTRUCTURA: secciones y destacamentos ---
//
// Replica de `getMemberAllowedDestIds` y `filterSectionalsByMemberScope`. Dos
// cosas distintas de la de arriba: aqui no se mira a las personas sino a la
// estructura, y el corte es la REGION.
//
// Los cargos de destacamento (Coordinador y su Asistente) y TODOS los de nivel
// seccion ven las secciones de su region y los destacamentos de esas secciones.
// Ni el pais entero —que es lo que veian— ni solo su seccion.
//
// El fallo que arregla en los cargos regionales: la sesion de cualquier miembro
// lleva `alcance.modo: 'destacamento'` aunque su cargo sea regional (lo pone
// `mergeMemberScope` cuando el perfil no trae otro), asi que se decidia por ahi,
// se le pedian "sus destacamentos" —que un cargo regional no tiene— y la lista
// salia VACIA.
const DESTACAMENTOS = [
  { id: 231, idSeccion: 'A' },
  { id: 233, idSeccion: 'A' },
  { id: 240, idSeccion: 'B' },
  { id: 310, idSeccion: 'C' },
];

const SECCIONES = [
  { idSeccion: 'A', regionalId: 'R1' },
  { idSeccion: 'B', regionalId: 'R1' },
  { idSeccion: 'C', regionalId: 'R2' },
];

// Los cargos que se paran en su region: los de destacamento y los de seccion.
const CARGOS_DE_DESTACAMENTO = [
  'usuario_destacamento',
  'usuario_destacamento_asistente',
  'pastor_destacamento',
  'lider_grupo',
];

const veLaEstructuraDeSuRegion = (user) =>
  nivelDeSusCargos(user) === 'seccion' ||
  cargosQueEjerce(user).some((codigo) => CARGOS_DE_DESTACAMENTO.includes(codigo));

// La region de alguien: la de su seccion, o la de su destacamento.
const suRegion = (user) => {
  const suSeccion =
    (user.secciones ?? [])[0] ??
    DESTACAMENTOS.find((d) => String(d.id) === String(user.idDestacamento))?.idSeccion;

  return (
    (user.regiones ?? [])[0] ?? SECCIONES.find((s) => s.idSeccion === suSeccion)?.regionalId ?? ''
  );
};

const seccionesDeLaRegion = (region) =>
  SECCIONES.filter((s) => s.regionalId === region).map((s) => s.idSeccion);

// Un miembro sin ningun cargo. Siempre esta atado a un destacamento, asi que de
// ahi salen su seccion y su region.
const esUsuarioComun = (user) => !cargosQueEjerce(user).length;

// El Pastor mira la estructura de su region, incluidos sus destacamentos, pero
// los miembros siguen limitados a los suyos.
const esPastor = (user) => cargosQueEjerce(user).includes('pastor_destacamento');

const seccionesVisibles = (user) => {
  if (nivelDeSusCargos(user) === 'nacional') return SECCIONES.map((s) => s.idSeccion);
  if (veLaEstructuraDeSuRegion(user) || esUsuarioComun(user) || esPastor(user)) {
    return seccionesDeLaRegion(suRegion(user));
  }

  return SECCIONES.map((s) => s.idSeccion);
};

const destacamentosVisibles = (user) => {
  const nivel = nivelDeSusCargos(user);

  if (nivel === 'nacional') return DESTACAMENTOS.map((d) => d.id);

  if (nivel === 'region' || veLaEstructuraDeSuRegion(user)) {
    const deLaRegion = seccionesDeLaRegion(suRegion(user));

    return DESTACAMENTOS.filter((d) => deLaRegion.includes(d.idSeccion)).map((d) => d.id);
  }

  // El Usuario Comun se queda en su SECCION: sus dos listas no llegan igual de
  // lejos que las de un cargo.
  if (esUsuarioComun(user)) {
    const suSeccion = DESTACAMENTOS.find(
      (d) => String(d.id) === String(user.idDestacamento)
    )?.idSeccion;

    return DESTACAMENTOS.filter((d) => d.idSeccion === suSeccion).map((d) => d.id);
  }

  return DESTACAMENTOS.filter((d) => String(d.id) === String(user.idDestacamento)).map((d) => d.id);
};

test('un Sub-Director Regional ve los destacamentos de su region, no una lista vacia', () => {
  const subdirectorRegional = {
    rolId: 'usuario_region_asistente',
    idMiembros: 10002,
    regiones: ['R1'],
    // Lo que trae de verdad la sesion, y lo que antes lo dejaba sin nada.
    alcance: { modo: 'destacamento', destacamentos: [], regiones: ['R1'] },
  };

  assert.deepEqual(destacamentosVisibles(subdirectorRegional), [231, 233, 240]);
});

test('y no ve los de otra region', () => {
  const subdirectorRegional = {
    rolId: 'usuario_region_asistente',
    idMiembros: 10002,
    regiones: ['R1'],
  };

  assert.equal(destacamentosVisibles(subdirectorRegional).includes(310), false);
});

// El Coordinador de Destacamento y su Asistente veian las secciones del pais
// entero y los destacamentos de su seccion. Ahora las dos listas se paran en su
// region: ni mas ni menos.
test('el Coordinador de Destacamento ve la estructura de su region', () => {
  const coordinador = {
    rolId: 'usuario_destacamento',
    idMiembros: 326,
    idDestacamento: 231,
    cargos: [{ rol: 'usuario_destacamento', nivel: 'destacamento', idEntidad: 231 }],
  };

  assert.deepEqual(seccionesVisibles(coordinador), ['A', 'B']);
  assert.deepEqual(destacamentosVisibles(coordinador), [231, 233, 240]);
});

test('y no ve nada de otra region', () => {
  const coordinador = {
    rolId: 'usuario_destacamento',
    idMiembros: 326,
    idDestacamento: 231,
    cargos: [{ rol: 'usuario_destacamento', nivel: 'destacamento', idEntidad: 231 }],
  };

  assert.equal(seccionesVisibles(coordinador).includes('C'), false);
  assert.equal(destacamentosVisibles(coordinador).includes(310), false);
});

test('los cargos de seccion se paran en su region igual que ellos', () => {
  const zonas = { rolId: 'zonas', idMiembros: 326, secciones: ['A'] };
  const coordinadorSeccional = { rolId: 'usuario_seccion', idMiembros: 326, secciones: ['A'] };

  assert.deepEqual(seccionesVisibles(zonas), ['A', 'B']);
  assert.deepEqual(destacamentosVisibles(coordinadorSeccional), [231, 233, 240]);
});

// A los miembros, en cambio, los sigue viendo cada quien en lo suyo: el
// Coordinador de Destacamento en el suyo y el seccional en su seccion. Ver la
// estructura de la region no es ver a su gente.
test('ver la estructura de la region no amplia a quien ve', () => {
  const coordinador = { rolId: 'usuario_destacamento', idMiembros: 326, idDestacamento: 231 };

  assert.deepEqual(nombres(coordinador), ['Roderi']);
});

// ----------------------------------------------------------------------
// El Usuario Comun.
//
// Sus tres listas se paran en sitios distintos, y esa es justo la regla: las
// secciones de su REGION, los destacamentos de su SECCION, y los miembros de su
// DESTACAMENTO. No es una excepcion caprichosa: siempre esta atado a un
// destacamento, y de ahi salen los otros dos.
// ----------------------------------------------------------------------

const USUARIO_COMUN = { idMiembros: 326, idDestacamento: 231 };

test('el Usuario Comun ve las secciones de su region', () => {
  assert.deepEqual(seccionesVisibles(USUARIO_COMUN), ['A', 'B']);
});

test('pero solo los destacamentos de su seccion', () => {
  assert.deepEqual(destacamentosVisibles(USUARIO_COMUN), [231, 233]);
});

test('y los miembros solo de su destacamento', () => {
  assert.deepEqual(nombres(USUARIO_COMUN), ['Roderi']);
});

test('nada de otra region ni de la seccion de al lado', () => {
  assert.equal(seccionesVisibles(USUARIO_COMUN).includes('C'), false);
  assert.equal(destacamentosVisibles(USUARIO_COMUN).includes(240), false);
});

// ----------------------------------------------------------------------
// El Pastor de Destacamento.
//
// Ve las secciones y los destacamentos de su region, como los demas cargos de su
// destacamento. Los miembros siguen siendo solo los suyos. No entra en la lista
// de los que INTERACTUAN con su seccion —es de solo lectura—, y mirar la
// estructura de su region no es interactuar con nada.
// ----------------------------------------------------------------------

const PASTOR = {
  rolId: 'pastor_destacamento',
  idMiembros: 326,
  idDestacamento: 231,
  cargos: [{ rol: 'pastor_destacamento', nivel: 'destacamento', idEntidad: 231 }],
};

test('el Pastor ve las secciones de su region', () => {
  assert.deepEqual(seccionesVisibles(PASTOR), ['A', 'B']);
});

test('y ve los destacamentos de su region', () => {
  assert.deepEqual(destacamentosVisibles(PASTOR), [231, 233, 240]);
});

test('y de miembros, los de su destacamento', () => {
  assert.deepEqual(nombres(PASTOR), ['Roderi']);
});
