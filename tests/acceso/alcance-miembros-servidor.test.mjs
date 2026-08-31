import test from 'node:test';
import assert from 'node:assert/strict';

import {
  miembrosDelAlcance,
  destacamentosDelAlcance,
  nivelDeAlcanceDeMiembros,
} from '../../src/server/alcance-miembros-core.mjs';

// ----------------------------------------------------------------------
// El padron no sale entero del servidor.
//
// El navegador ya decidia a quien ve cada quien, pero eso solo ordena lo que
// PINTA: la lista completa —telefonos, direcciones y fechas de nacimiento de
// menores— ya habia viajado hasta el. Esta es la misma regla dicha al salir.
// ----------------------------------------------------------------------

// Region 1: secciones 1 y 2. Region 2: seccion 3.
const estructura = {
  secciones: [
    { idSeccion: '1', idRegion: '1' },
    { idSeccion: '2', idRegion: '1' },
    { idSeccion: '3', idRegion: '2' },
  ],
  iglesias: [
    { idIglesia: 'i1', idSeccion: '1' },
    { idIglesia: 'i2', idSeccion: '2' },
    { idIglesia: 'i3', idSeccion: '3' },
  ],
  destacamentos: [
    { idDestacamento: '231', idIglesia: 'i1' },
    { idDestacamento: '233', idIglesia: 'i1' },
    { idDestacamento: '240', idIglesia: 'i2' },
    { idDestacamento: '310', idIglesia: 'i3' },
  ],
};

const miembros = [
  { idMiembros: 1, idDestacamento: '231' },
  { idMiembros: 2, idDestacamento: '233' },
  { idMiembros: 3, idDestacamento: '240' },
  { idMiembros: 4, idDestacamento: '310' },
];

const ve = (acceso) =>
  (miembrosDelAlcance({ acceso, miembros, estructura }) ?? []).map((m) => m.idDestacamento);

const cargo = (nivel, rol = 'un_cargo') => ({ rol, nivel, idEntidad: '' });

test('sin cargo se ve el propio destacamento', () => {
  assert.deepEqual(ve({ alcance: { destacamentos: ['231'] }, idMiembros: '1' }), ['231']);
});

test('un cargo de seccion ve los de su seccion', () => {
  const acceso = {
    cargos: [cargo('seccional')],
    alcance: { secciones: ['1'] },
    idMiembros: '1',
  };

  assert.deepEqual(ve(acceso), ['231', '233']);
});

test('y no los de la seccion de al lado', () => {
  const acceso = { cargos: [cargo('seccional')], alcance: { secciones: ['1'] } };

  assert.equal(ve(acceso).includes('240'), false);
});

test('un cargo de region ve toda su region', () => {
  const acceso = { cargos: [cargo('regional')], alcance: { regiones: ['1'] } };

  assert.deepEqual(ve(acceso), ['231', '233', '240']);
});

test('y no la region de al lado', () => {
  const acceso = { cargos: [cargo('regional')], alcance: { regiones: ['1'] } };

  assert.equal(ve(acceso).includes('310'), false);
});

test('un cargo nacional ve el padron entero', () => {
  assert.equal(ve({ cargos: [cargo('nacional')] }).length, miembros.length);
});

for (const rol of ['administrador_global', 'administrador_funcional', 'oficina_nacional']) {
  test(`${rol} ve el padron entero`, () => {
    assert.equal(ve({ rol }).length, miembros.length);
  });
}

// Manda el nivel MAS AMPLIO de sus cargos: quien coordina su destacamento y
// ademas ocupa una casilla en su seccion mira a los de toda la seccion.
test('con dos cargos manda el mas amplio', () => {
  const acceso = {
    cargos: [cargo('destacamento'), cargo('seccional')],
    alcance: { destacamentos: ['231'], secciones: ['1'] },
  };

  assert.deepEqual(ve(acceso), ['231', '233']);
});

test('su propia ficha aparece aunque su destacamento no este en el alcance', () => {
  const acceso = { alcance: { destacamentos: ['999'] }, idMiembros: '4' };

  assert.deepEqual(ve(acceso), ['310']);
});

// `null` es "no lo se", no "ninguno": quien llama deja pasar la lista y lo
// avisa. Devolver vacio por no saber es como se rompen las pantallas.
// El Usuario Comun no ocupa casilla: su alcance viene vacio y su destacamento
// sale de su propia ficha, que ya viene en la lista.
test('el Usuario Comun ve su destacamento aunque su alcance venga vacio', () => {
  assert.deepEqual(ve({ idMiembros: '3' }), ['240']);
});

test('y sigue sin ver los de otro destacamento', () => {
  assert.equal(ve({ idMiembros: '3' }).includes('231'), false);
});

test('sin alcance que resolver devuelve null, no una lista vacia', () => {
  // Sin cargo Y sin poder identificar su ficha: ahi si es "no lo se".
  assert.equal(miembrosDelAlcance({ acceso: {}, miembros, estructura }), null);
  assert.equal(
    destacamentosDelAlcance({ nivel: 'seccion', alcance: { secciones: [] }, estructura }),
    null
  );
});

test('sin estructura cargada tampoco se inventa un alcance', () => {
  const acceso = { cargos: [cargo('regional')], alcance: { regiones: ['1'] } };

  assert.equal(miembrosDelAlcance({ acceso, miembros, estructura: {} }), null);
});

test('el claim del token sirve de respaldo cuando no hay cargos', () => {
  assert.equal(nivelDeAlcanceDeMiembros({ alcanceNivel: 'region' }), 'region');
  assert.equal(nivelDeAlcanceDeMiembros({ alcanceNivel: 'nacional' }), 'todo');
  assert.equal(nivelDeAlcanceDeMiembros({}), 'destacamento');
});
