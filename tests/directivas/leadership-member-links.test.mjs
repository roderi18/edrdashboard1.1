import fs from 'node:fs';
import test from 'node:test';
import path from 'node:path';
import assert from 'node:assert/strict';

const leer = (relativa) => fs.readFileSync(path.join(process.cwd(), relativa), 'utf8');

const VISTAS_DE_DIRECTIVA = [
  'src/sections/national/leadership/national-leadership-view.jsx',
  'src/sections/regional/leadership/regional-leadership-view.jsx',
  'src/sections/sectional/leadership/sectional-leadership-view.jsx',
];

test('consejo nacional, region y seccion enlazan el nombre del ocupante', () => {
  VISTAS_DE_DIRECTIVA.forEach((archivo) => {
    const vista = leer(archivo);

    assert.match(vista, /LeadershipMemberNameLink/);
    assert.match(vista, /miembroAsignado=\{miembroAsignado\}/);
  });
});

test('el enlace compartido lleva al edit del miembro y no se crea para vacantes', () => {
  const identidad = leer('src/sections/common/leadership-node-identity.jsx');

  assert.match(identidad, /`\/dashboard\/level\/member\/\$\{memberId\}\/edit`/);
  assert.match(identidad, /memberId && !identity\.vacante && !identity\.restringido/);
  assert.match(identidad, /component=\{RouterLink\}/);
});

test('destacamento conserva su enlace al edit del miembro', () => {
  const destacamento = leer('src/app/dashboard/level/dest/[id]/edit/leadership/page.jsx');

  assert.match(destacamento, /`\/dashboard\/level\/member\/\$\{miembroAsignadoId\}\/edit`/);
  assert.match(destacamento, /component=\{RouterLink\}/);
});
