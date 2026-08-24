import test from 'node:test';
import assert from 'node:assert/strict';

import {
  rangoDe,
  mandaMasQue,
  alcanzaLaUbicacion,
  decidirGestionDeMiembro,
} from '../../src/server/alcance-gestion-miembros-core.mjs';

// ----------------------------------------------------------------------
// Quien puede restablecerle el acceso a quien.
//
// Un codigo de un solo uso abre la cuenta del otro CON SUS PERMISOS, asi que
// esta regla es lo unico que separa "el Coordinador ayuda a su Lider de Grupo"
// de "un Lider de Grupo entra en la cuenta del Director Nacional".
// ----------------------------------------------------------------------

const coordinador = (idDestacamento) => [
  { rol: 'coordinador_destacamento', nivel: 'destacamento', idEntidad: String(idDestacamento), orden: 1 },
];

const liderGrupo = (idDestacamento) => [
  { rol: 'lider_grupo', nivel: 'destacamento', idEntidad: String(idDestacamento), orden: 5 },
];

const subCoordinadorSeccion = (idSeccion) => [
  { rol: 'sub_coordinador_seccional', nivel: 'seccional', idEntidad: String(idSeccion), orden: 2 },
];

const directorNacional = () => [
  { rol: 'director_nacional', nivel: 'nacional', idEntidad: '', orden: 1 },
];

const ubicacion = ({ destacamento = '', seccion = '', region = '' } = {}) => ({
  idDestacamento: String(destacamento),
  idSeccion: String(seccion),
  idRegion: String(region),
});

test('el nivel manda por encima del orden', () => {
  assert.equal(mandaMasQue(rangoDe(directorNacional()), rangoDe(coordinador(7))), true);
  assert.equal(mandaMasQue(rangoDe(coordinador(7)), rangoDe(directorNacional())), false);
});

test('dentro del mismo nivel manda quien esta mas arriba en el organigrama', () => {
  assert.equal(mandaMasQue(rangoDe(coordinador(7)), rangoDe(liderGrupo(7))), true);
  assert.equal(mandaMasQue(rangoDe(liderGrupo(7)), rangoDe(coordinador(7))), false);
});

test('quien no tiene cargo no manda sobre nadie con cargo', () => {
  assert.equal(mandaMasQue(rangoDe([]), rangoDe(liderGrupo(7))), false);
  assert.equal(mandaMasQue(rangoDe(liderGrupo(7)), rangoDe([])), true);
});

test('el Coordinador puede con un miembro de su destacamento', () => {
  const decision = decidirGestionDeMiembro({
    cargosSolicitante: coordinador(7),
    cargosObjetivo: [],
    ubicacionObjetivo: ubicacion({ destacamento: 7, seccion: 3, region: 1 }),
  });

  assert.deepEqual(decision, { permitido: true, motivo: '' });
});

test('el Coordinador NO puede con un miembro de otro destacamento', () => {
  const decision = decidirGestionDeMiembro({
    cargosSolicitante: coordinador(7),
    cargosObjetivo: [],
    ubicacionObjetivo: ubicacion({ destacamento: 9, seccion: 4, region: 1 }),
  });

  assert.equal(decision.permitido, false);
  assert.equal(decision.motivo, 'fuera_de_alcance');
});

test('el Lider de Grupo NO puede con el Coordinador de su propio destacamento', () => {
  const decision = decidirGestionDeMiembro({
    cargosSolicitante: liderGrupo(7),
    cargosObjetivo: coordinador(7),
    ubicacionObjetivo: ubicacion({ destacamento: 7, seccion: 3, region: 1 }),
  });

  assert.equal(decision.permitido, false);
  assert.equal(decision.motivo, 'objetivo_de_igual_o_mayor_nivel');
});

test('el Lider de Grupo NO puede con un cargo nacional', () => {
  const decision = decidirGestionDeMiembro({
    cargosSolicitante: liderGrupo(7),
    cargosObjetivo: directorNacional(),
    ubicacionObjetivo: ubicacion({ destacamento: 7, seccion: 3, region: 1 }),
  });

  assert.equal(decision.permitido, false);
  assert.equal(decision.motivo, 'objetivo_de_igual_o_mayor_nivel');
});

test('dos cargos iguales no pueden entrar el uno en la cuenta del otro', () => {
  const decision = decidirGestionDeMiembro({
    cargosSolicitante: coordinador(7),
    cargosObjetivo: coordinador(7),
    ubicacionObjetivo: ubicacion({ destacamento: 7, seccion: 3, region: 1 }),
  });

  assert.equal(decision.permitido, false);
  assert.equal(decision.motivo, 'objetivo_de_igual_o_mayor_nivel');
});

test('un cargo seccional alcanza a los destacamentos de su seccion', () => {
  const decision = decidirGestionDeMiembro({
    cargosSolicitante: subCoordinadorSeccion(3),
    cargosObjetivo: liderGrupo(7),
    ubicacionObjetivo: ubicacion({ destacamento: 7, seccion: 3, region: 1 }),
  });

  assert.deepEqual(decision, { permitido: true, motivo: '' });
});

test('un cargo seccional NO alcanza a otra seccion', () => {
  const decision = decidirGestionDeMiembro({
    cargosSolicitante: subCoordinadorSeccion(3),
    cargosObjetivo: liderGrupo(9),
    ubicacionObjetivo: ubicacion({ destacamento: 9, seccion: 4, region: 1 }),
  });

  assert.equal(decision.permitido, false);
  assert.equal(decision.motivo, 'fuera_de_alcance');
});

test('un cargo nacional alcanza a todo el pais', () => {
  assert.equal(
    alcanzaLaUbicacion(directorNacional(), ubicacion({ destacamento: 99, seccion: 12, region: 4 })),
    true
  );
});

test('sin ficha del objetivo no se permite nada', () => {
  const decision = decidirGestionDeMiembro({
    cargosSolicitante: coordinador(7),
    cargosObjetivo: [],
    ubicacionObjetivo: null,
  });

  assert.equal(decision.permitido, false);
  assert.equal(decision.motivo, 'objetivo_sin_ficha');
});

test('un destacamento sin ubicacion resoluble no cuela por comparacion vacia', () => {
  // Si el catalogo no resuelve la seccion ni la region, los ids vienen vacios.
  // Compararlos "a ciegas" haria que dos vacios coincidieran y todo pasara.
  const decision = decidirGestionDeMiembro({
    cargosSolicitante: [
      { rol: 'sub_coordinador_seccional', nivel: 'seccional', idEntidad: '', orden: 2 },
    ],
    cargosObjetivo: [],
    ubicacionObjetivo: ubicacion({ destacamento: 7 }),
  });

  assert.equal(decision.permitido, false);
  assert.equal(decision.motivo, 'fuera_de_alcance');
});
