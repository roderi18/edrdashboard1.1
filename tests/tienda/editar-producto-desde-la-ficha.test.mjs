import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { register } from 'node:module';
import assert from 'node:assert/strict';

// El codigo REAL, por el mismo alias con el que lo importa la aplicacion.
register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

// EL LAPIZ DENTRO DEL PRODUCTO.
//
// El Administrador Global abria la ficha de un producto
// (/dashboard/product/errd-002-emblema-pequeno) y no tenia por donde editarlo:
// el lapiz solo se le enseñaba al Administrador de Tienda. Y quien si lo tenia
// llegaba a un formulario que arrancaba con "Publicar" encendido aunque el
// producto fuera un borrador, asi que guardar un precio lo publicaba.

const { canEditStoreProduct, canManageStoreProducts } = await import('src/utils/member-access.js');

const leer = (relativa) => fs.readFileSync(path.join(process.cwd(), relativa), 'utf8');

const global = { rolId: 'administrador_global' };
const tienda = { rolId: 'administrador_tienda' };
const funcional = { rolId: 'administrador_funcional' };
const coordinador = { rolId: 'usuario_destacamento' };

test('editan un producto el Administrador Global y el de Tienda', () => {
  assert.equal(canEditStoreProduct(global), true);
  assert.equal(canEditStoreProduct(tienda), true);
});

test('ningun otro cargo edita productos', () => {
  assert.equal(canEditStoreProduct(funcional), false);
  assert.equal(canEditStoreProduct(coordinador), false);
  assert.equal(canEditStoreProduct({}), false);
});

test('gestionar la tienda (crear, publicar, borrar) sigue siendo solo del de Tienda', () => {
  assert.equal(canManageStoreProducts(tienda), true);
  assert.equal(canManageStoreProducts(global), false);
});

test('la ficha del producto enseña el lapiz a quien puede editar y lleva al editor', () => {
  const ficha = leer('src/sections/product/view/product-details-view.jsx');
  const barra = leer('src/sections/product/product-details-toolbar.jsx');

  assert.match(ficha, /const canEdit = canEditStoreProduct\(user\);/);
  assert.match(ficha, /canEdit=\{canEdit\}/);
  assert.match(ficha, /editHref=\{paths\.dashboard\.product\.edit\(/);

  // El lapiz depende de canEdit, no de la gestion de la tienda.
  assert.match(barra, /\{canEdit && \(\s*<Tooltip title="Editar producto">/);
  assert.match(barra, /href=\{editHref\}/);
});

test('el editor no se abre escribiendo la direccion a mano sin permiso', () => {
  const editor = leer('src/sections/product/view/product-edit-view.jsx');

  assert.match(editor, /const canEdit = canEditStoreProduct\(user\);/);
  assert.match(editor, /!canEdit \? \(/);
});

test('el editor arranca con el estado de publicacion del producto, no con "Publicar"', () => {
  const formulario = leer('src/sections/product/product-create-edit-form.jsx');

  assert.match(
    formulario,
    /useState\(\s*currentProduct \? currentProduct\.publish === 'published' : true\s*\)/
  );
  assert.doesNotMatch(formulario, /const \[publish, setPublish\] = useState\(true\);/);
});
