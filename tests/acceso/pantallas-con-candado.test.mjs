import fs from 'node:fs';
import test from 'node:test';
import path from 'node:path';
import assert from 'node:assert/strict';

// ----------------------------------------------------------------------
// A lo ajeno no se entra, ni con el enlace pegado.
//
// La lista muestra solo lo suyo, pero la ficha se abria escribiendo la URL: la
// de una seccion o un destacamento de otra region incluidas. Y la pantalla de
// Asistencia no comprobaba NADA —el menu no se la ofrecia a quien no lleva
// `asistencia.ver`, pero entrar entraba cualquiera—.
//
// Se fija que el candado siga puesto. Que decida bien es cosa de los filtros de
// alcance, que tienen sus propias pruebas.
// ----------------------------------------------------------------------

const leer = (relativa) => fs.readFileSync(path.join(process.cwd(), relativa), 'utf8');

const FICHAS_CON_CANDADO = [
  ['la seccion', 'src/sections/sectional/layout/sectional-edit-layout.jsx', 'seccion'],
  ['el destacamento', 'src/sections/dest/layout/dest-edit-layout.jsx', 'destacamento'],
];

for (const [nombre, fichero, tipo] of FICHAS_CON_CANDADO) {
  test(`la ficha de ${nombre} no se abre si no es suya`, () => {
    const codigo = leer(fichero);

    assert.match(codigo, /<CandadoDeAlcance/);
    assert.match(codigo, new RegExp(`tipo="${tipo}"`));
  });
}

// La region tiene su propia puerta —la regla es mas estricta: quien no la ve
// entera no entra a ninguna que no sea la suya—, pero puerta al fin.
test('la ficha de la region tampoco', () => {
  const codigo = leer('src/sections/regional/layout/regional-edit-layout.jsx');

  assert.match(codigo, /puedeEntrarALaRegion/);
  assert.match(codigo, /puedeEntrar === null/);
});

// El candado pregunta lo MISMO que la lista: los mismos filtros, no una regla
// paralela que se desincronice con el tiempo.
test('el candado usa los filtros de alcance de la lista', () => {
  const codigo = leer('src/sections/common/use-entidad-en-su-alcance.js');

  assert.match(codigo, /filterDestsByMemberScope/);
  assert.match(codigo, /filterSectionalsByMemberScope/);
});

test('la asistencia exige permiso para entrar y otro para pasarla', () => {
  const codigo = leer('src/sections/attendance/view/attendance-quick-view.jsx');

  assert.match(codigo, /can\(user, PERMISOS\.ASISTENCIA_VER\)/);
  assert.match(codigo, /puedeModificar\(user, PERMISOS\.ASISTENCIA_CREAR\)/);
  assert.match(codigo, /if \(!puedeVerAsistencia\)/);
  assert.match(codigo, /if \(!puedePasarAsistencia\)/);
});

// Sin estructura, `getMemberAllowedDestIds` devuelve "sin restriccion": el
// desplegable ofrecia los destacamentos del pais entero.
test('la asistencia acota su desplegable con la estructura cargada', () => {
  const codigo = leer('src/sections/attendance/view/attendance-quick-view.jsx');

  assert.match(codigo, /getMemberAllowedDestIds\(user, \{[\s\S]{0,120}sectionals/);
});
