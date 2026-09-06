import fs from 'node:fs';
import test from 'node:test';
import path from 'node:path';
import assert from 'node:assert/strict';

const leer = (relativa) => fs.readFileSync(path.join(process.cwd(), relativa), 'utf8');

const vista = leer('src/sections/member/view/member-list-view.jsx');
const listaDeTarjetas = leer('src/sections/common/compact-entity-card-list.jsx');
const fotos = leer('src/utils/firebase-photos.js');

test('la pagina de la lista de miembros viaja en la URL', () => {
  assert.match(vista, /searchParams\.get\('p'\)/);
  assert.match(vista, /useTable\(\{ defaultCurrentPage: pageFromUrl \}\)/);
  assert.match(vista, /params\.set\('p', String\(zeroBasedPage \+ 1\)\)/);
  assert.match(vista, /window\.history\.replaceState/);
});

test('tabla y tarjetas comparten la misma pagina guardada', () => {
  assert.match(vista, /onPageChange=\{handleChangePage\}/);
  assert.match(vista, /page=\{table\.page \+ 1\}/);
  assert.match(vista, /onPageChange=\{handleChangeCardPage\}/);
  assert.doesNotMatch(vista, /onPageChange=\{table\.onChangePage\}/);
});

test('un filtro que llega por URL no pisa la pagina guardada', () => {
  assert.match(vista, /if \(!pageFromUrl\) table\.onResetPage\(\);/);
});

test('la lista de tarjetas acepta que la pagina la lleve la vista', () => {
  assert.match(listaDeTarjetas, /page: pageProp/);
  assert.match(listaDeTarjetas, /const isControlled = pageProp !== undefined && pageProp !== null;/);
  assert.match(listaDeTarjetas, /if \(isControlled\) return;\s*\n\s*setInternalPage\(1\);/);
  assert.match(listaDeTarjetas, /Math\.min\(isControlled \? pageProp : internalPage, pageCount\)/);
});

test('las fotos de los miembros se recuerdan para que no pestaneen al volver', () => {
  assert.match(fotos, /export function obtenerFotosPrincipalesEnCache/);
  assert.match(fotos, /fotosPrincipalesCache\.set\(/);
  assert.match(vista, /useState\(mapMemberPhotoUrls\)/);
  assert.doesNotMatch(vista, /setMemberPhotoUrls\(\{\}\)/);
});
