import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const layouts = [
  'src/sections/dest/layout/dest-edit-layout.jsx',
  'src/sections/sectional/layout/sectional-edit-layout.jsx',
  'src/sections/regional/layout/regional-edit-layout.jsx',
];

test('destacamento, sección y región usan la misma navegación de perfil', () => {
  for (const ruta of layouts) {
    const layout = fs.readFileSync(ruta, 'utf8');

    assert.match(layout, /import \{ OrganizationalProfileNavigation \}/, ruta);
    assert.match(layout, /<OrganizationalProfileNavigation/, ruta);
  }
});

test('la navegación común coloca nombre, tabs y ruta en ese orden', () => {
  const navegacion = fs.readFileSync(
    'src/sections/common/organizational-profile-navigation.jsx',
    'utf8'
  );
  const titulo = navegacion.indexOf('<CustomBreadcrumbs heading={heading}');
  const tabs = navegacion.indexOf('<Tabs value={value}');
  const ruta = navegacion.indexOf("{ name: 'Panel', href: paths.dashboard.root }");

  assert.ok(titulo >= 0 && titulo < tabs);
  assert.ok(tabs < ruta);
  assert.match(navegacion, /separator: '•'/);
});

test('las altas organizacionales comparten el botón adaptable', () => {
  const vistas = [
    'src/sections/member/view/member-list-view.jsx',
    'src/sections/dest/view/dest-list-view.jsx',
    'src/sections/sectional/view/sectional-list-view.jsx',
    'src/sections/regional/view/regional-list-view.jsx',
  ];

  for (const ruta of vistas) {
    const vista = fs.readFileSync(ruta, 'utf8');

    assert.match(vista, /import \{ OrganizationalCreateButton \}/, ruta);
    assert.match(vista, /<OrganizationalCreateButton/, ruta);
  }

  const boton = fs.readFileSync(
    'src/sections/common/organizational-create-button.jsx',
    'utf8'
  );

  assert.match(boton, /bgcolor: 'common.white'/);
  assert.match(boton, /color: 'common.black'/);
  assert.match(boton, /display: \{ xs: 'none', sm: 'inline' \}/);
});
