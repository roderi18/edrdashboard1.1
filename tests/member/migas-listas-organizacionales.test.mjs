import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const vistas = {
  national: 'src/sections/national/view/national-list-view.jsx',
  regional: 'src/sections/regional/view/regional-list-view.jsx',
  sectional: 'src/sections/sectional/view/sectional-list-view.jsx',
  dest: 'src/sections/dest/view/dest-list-view.jsx',
  member: 'src/sections/member/view/member-list-view.jsx',
};

test('las cinco listas organizacionales usan la misma cabecera', () => {
  for (const [nivel, ruta] of Object.entries(vistas)) {
    const vista = fs.readFileSync(ruta, 'utf8');

    assert.match(vista, /import \{ OrganizationalListBreadcrumbs \}/, ruta);
    assert.match(
      vista,
      new RegExp(`<OrganizationalListBreadcrumbs\\s+\\n?\\s*nivel="${nivel}"`),
      ruta
    );
    assert.doesNotMatch(vista, /<CustomBreadcrumbs/, ruta);
  }
});

test('la cabecera compartida define las cinco rutas y el separador', () => {
  const cabecera = fs.readFileSync(
    'src/sections/common/organizational-list-breadcrumbs.jsx',
    'utf8'
  );

  for (const nivel of Object.keys(vistas)) {
    assert.match(cabecera, new RegExp(`\\b${nivel}:`));
  }

  assert.match(cabecera, /separator: '•'/);
  assert.match(cabecera, /\{ name: 'Panel', href: paths\.dashboard\.root \}/);
  assert.match(cabecera, /\{ name: 'Lista' \}/);
});
