// ----------------------------------------------------------------------
// EL EX COMANDANTE SE LLAMA "EX DIRECTOR NACIONAL" Y VA EN EL CONSEJO NACIONAL.
//
// Qué se rompía: la lista de la Directiva Nacional los llamaba "Ex Comandante
// Nacional" (el nombre antiguo del cargo) y los ponía con nivel organizacional
// "Consejo Ejecutivo", donde solo están los cargos de hoy.
// ----------------------------------------------------------------------

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import '../soporte/resolver-alias-src.mjs';

const { cargoPorId } = await import('../../src/utils/directiva-cuatrienios.mjs');

const lista = readFileSync(
  new URL('../../src/sections/national/view/national-list-view.jsx', import.meta.url),
  'utf8'
);

test('el cargo del grupo de ex comandantes se llama Ex Director Nacional', () => {
  assert.equal(cargoPorId('ex_comandante').nombres.nacional, 'Ex Director Nacional');
});

test('en la lista, posición Ex Director Nacional y nivel Consejo Nacional', () => {
  assert.match(lista, /ETIQUETA_EX_DIRECTOR = 'Ex Director Nacional'/);
  assert.match(lista, /NIVEL_CONSEJO_NACIONAL = 'Consejo Nacional'/);
  assert.match(lista, /nationalXMemberPositionLabel: ETIQUETA_EX_DIRECTOR,/);
  assert.match(lista, /nationalOrganizationalLevel: NIVEL_CONSEJO_NACIONAL,/);
  assert.doesNotMatch(lista, /'Ex Comandante Nacional'/);
});

// ----------------------------------------------------------------------
// Y LLEVA SUS AÑOS, SACADOS DE LA GALERÍA DE DIRECTORES NACIONALES.
// La galería y el padrón no escriben el nombre igual: se casan por palabras.
// ----------------------------------------------------------------------

const { periodoDeDirectorPorNombre, periodoSinCargo } =
  await import('../../src/utils/galeria-directores.mjs');

const GALERIA = [
  { nombre: 'Rev. Dany Trinidad Feliz', anio: '2010-2014 / 2018-2020' },
  { nombre: 'Mirke de León', anio: 'Ex Director Nacional 2008-2010' },
  { nombre: 'Rafael Cueto', anio: '2004-2008' },
  { nombre: 'Amarante Cueto', anio: '1999-2001' },
  { nombre: 'Rev. Domingo A. Amancio', anio: 'Ex Director Nacional 1997-1999' },
  { nombre: 'William de la Cruz', anio: 'Ex Director Nacional 1978-1985' },
];

test('el periodo se encuentra aunque el nombre esté escrito distinto', () => {
  assert.equal(periodoDeDirectorPorNombre(GALERIA, 'Dany Trinidad'), '2010-2014 / 2018-2020');
  assert.equal(periodoDeDirectorPorNombre(GALERIA, 'Mirke de Leon'), '2008-2010');
  assert.equal(periodoDeDirectorPorNombre(GALERIA, 'Domingo Amancio'), '1997-1999');
  assert.equal(periodoDeDirectorPorNombre(GALERIA, 'Wilian de la Cruz'), '1978-1985');
});

test('dos con el mismo apellido no se confunden, y quien no está queda sin año', () => {
  assert.equal(periodoDeDirectorPorNombre(GALERIA, 'Rafael Cueto'), '2004-2008');
  assert.equal(periodoDeDirectorPorNombre(GALERIA, 'Amarante Cueto'), '1999-2001');
  assert.equal(periodoDeDirectorPorNombre(GALERIA, 'Amós Encarnación'), '');
  assert.equal(periodoDeDirectorPorNombre(GALERIA, 'Cueto'), '');
});

test('del texto de la galería solo quedan los años', () => {
  assert.equal(periodoSinCargo('Ex Director Nacional 2022-2026'), '2022-2026');
});

test('los años van debajo de la posición, no pegados al cargo', () => {
  assert.match(lista, /nationalXMemberPositionPeriodo: periodoDeExDirector\(/);
  assert.doesNotMatch(lista, /\$\{ETIQUETA_EX_DIRECTOR\} \$\{/);
});
