// ----------------------------------------------------------------------
// /dashboard/user ES EL PERFIL DE QUIEN TIENE LA SESIÓN.
//
// Qué se rompía: sin `?idMiembros=` la pantalla pintaba el usuario de ejemplo
// de la plantilla —"Roderi Pena", "CTO" y un avatar de dibujo— a cualquiera que
// entrara, y el muro era el de todos. Ahora sale el nombre y la foto de la
// sesión, solo sus publicaciones, y donde decía "CTO" su destacamento con nombre
// y número (solo el nombre si no tiene número).
// ----------------------------------------------------------------------

import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { readFile } from 'node:fs/promises';

register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

const { etiquetaDeDestacamento, destacamentoDelMiembro } =
  await import('../../src/utils/destacamento-del-perfil.mjs');

test('el destacamento sale con su nombre y su número', () => {
  assert.equal(
    etiquetaDeDestacamento({ name: 'Tribu de Judá', destNumber: '18' }),
    'Tribu de Judá 18'
  );
});

test('sin número, solo el nombre', () => {
  assert.equal(etiquetaDeDestacamento({ name: 'Tribu de Judá', destNumber: '' }), 'Tribu de Judá');
  assert.equal(etiquetaDeDestacamento({ nombre: 'Leones', numero: null }), 'Leones');
});

test('si el nombre ya lleva el número no se repite', () => {
  assert.equal(
    etiquetaDeDestacamento({ name: 'Destacamento 18', destNumber: '18' }),
    'Destacamento 18'
  );
});

test('se busca por la ficha del miembro, no por el id interno como número', () => {
  const miembros = [{ id: '326', idDestacamento: 231 }];
  const destacamentos = [
    { id: '230', name: 'Otro', destNumber: '7' },
    { id: '231', name: 'Tribu de Judá', destNumber: '18' },
  ];

  assert.equal(
    destacamentoDelMiembro({ idMiembros: 326, miembros, destacamentos }),
    'Tribu de Judá 18'
  );
  assert.equal(destacamentoDelMiembro({ idMiembros: 999, miembros, destacamentos }), '');
});

test('la pantalla usa la sesión y filtra el muro por su dueño', async () => {
  const vista = await readFile(
    new URL('../../src/sections/user/view/user-profile-view.jsx', import.meta.url),
    'utf8'
  );

  assert.match(vista, /useSessionProfile \|\| Boolean\(sessionUser\)/);
  assert.match(vista, /perfilIdMiembros=\{idMiembrosDelPerfil\}/);
  assert.doesNotMatch(vista, /_userAbout\.role/);
});
