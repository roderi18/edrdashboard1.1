// ----------------------------------------------------------------------
// "CARGO NACIONAL" DE LA FICHA = LA JERARQUÍA.
//
// Qué se rompía: todo el Consejo Nacional vigente salía en su ficha con
// "Cargo Nacional: Ninguno" aunque la Jerarquía los tuviera asignados (Director
// Nacional, Sub-Coordinador Seccional…). Los cargos se leían bien de Firestore,
// pero el miembro llega por partes y cada versión hacía `reset` del formulario
// con los cargos en vacío DESPUÉS de haberlos puesto. Estas pruebas cuidan que:
//  - lo leído de la Directiva se guarde y se reaplique tras cada reset;
//  - un Oficial Especial con título salga con su título en "Cargo Nacional",
//    en la franja de la tarjeta y en la columna Posición, en lugar de
//    "Oficial Especial"/"Oficial de la Nacional";
//  - una directiva PASADA no toque el perfil: en su tarjeta y su lista ni se
//    asignan ni se pintan títulos.
// Son comprobaciones del código fuente: el formulario es React y no corre en
// `node --test`.
// ----------------------------------------------------------------------

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const leer = (ruta) => readFileSync(new URL(`../../${ruta}`, import.meta.url), 'utf8');

test('la ficha vuelve a poner los cargos de la Directiva después de cada reset', () => {
  const ficha = leer('src/sections/member/member-create-edit-form.jsx');
  const efectoReset = ficha.match(
    /methods\.reset\(mapMemberToForm\(currentMember\)\);\s*reaplicarCargosDeDirectiva\(\);/
  );

  assert.ok(efectoReset, 'el reset de la ficha tiene que reaplicar los cargos leídos');
  assert.match(ficha, /cargosDeDirectivaRef\.current = \{/);
  // Se guarda por miembro: los de otra ficha no se cuelan en esta.
  assert.match(ficha, /leidos\.idMiembro !== idActual/);
});

test('"Cargo Nacional" nombra al Oficial Especial por su título', () => {
  const campo = leer('src/components/form/member-form/MemberLeadershipAndOtherSection.jsx');
  const selector = leer('src/components/api/cargo-institucional-select-api.jsx');

  assert.match(campo, /etiquetas=\{etiquetasCargoNacional\}/);
  assert.match(campo, /TituloOficialDialog/);
  // Solo sobre el cargo guardado: uno recién elegido aún no es Oficial.
  assert.match(campo, /getFieldState\('nationalLeadershipRole'\)\.isDirty/);
  assert.match(selector, /etiquetas\?\.\[getCargoValue\(cargo\)\] \|\| getCargoLabel\(cargo\)/);
});

test('la franja y la lista cambian "Oficial de la Nacional" por el título', () => {
  const grupo = leer('src/sections/national/leadership/oficiales-especiales-grupo.jsx');
  const fila = leer('src/sections/national/national-table-row.jsx');
  const lista = leer('src/sections/national/view/national-list-view.jsx');

  assert.match(
    grupo,
    /tituloDePersona\(persona\) \|\| persona\.cargo \|\| 'Oficial de la Nacional'/
  );
  assert.match(fila, /row\.nationalXMemberPositionTitulo \|\| row\.nationalXMemberPositionLabel/);
  assert.match(lista, /nationalXMemberPositionTitulo:/);
});

test('una directiva pasada no asigna ni pinta títulos', () => {
  const vista = leer('src/sections/national/leadership/national-leadership-view.jsx');
  const lista = leer('src/sections/national/view/national-list-view.jsx');

  assert.match(vista, /const puedeAsignarTitulo = !historico && permisosTitulo\.puedeAsignar;/);
  assert.match(vista, /mostrarTitulos=\{!historico\}/);
  // La memoria del cuatrienio conserva su cargo de entonces: sin título.
  assert.equal(lista.match(/nationalXMemberPositionTitulo:/g)?.length, 1);
});
