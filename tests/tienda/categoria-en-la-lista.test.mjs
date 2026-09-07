import fs from 'node:fs';
import test from 'node:test';
import path from 'node:path';
import assert from 'node:assert/strict';

// LA CATEGORIA SE ESCRIBE IGUAL EN TODAS PARTES.
//
// Bajo el nombre del producto salia el codigo tal cual —"insignias-emblemas"—
// mientras el desplegable de Categoria ofrecia "Insignias-Emblemas". Es el mismo
// dato: quien filtra por lo que lee en la lista tiene que encontrar ahi lo mismo
// que la lista le enseño.

const leer = (relativa) => fs.readFileSync(path.join(process.cwd(), relativa), 'utf8');

const fila = leer('src/sections/product/product-table-row.jsx');

test('bajo el nombre del producto va la etiqueta, no el codigo', () => {
  assert.match(fila, /secondary=\{etiquetaDeCategoria\(params\.row\.category\)\}/);
  assert.doesNotMatch(fila, /secondary=\{translateProductCategory\(/);
});

test('la lista, la columna, el filtro y sus chips usan la misma etiqueta', () => {
  const lista = leer('src/sections/product/view/product-list-view.jsx');
  const chips = leer('src/sections/product/product-table-filters-result.jsx');

  // La columna "Categoría".
  assert.match(fila, /return etiquetaDeCategoria\(params\.row\.category\);/);
  // Las opciones del desplegable.
  assert.match(lista, /label: etiquetaDeCategoria\(valor\)/);
  // Y los chips de lo que ya se filtro.
  assert.match(chips, /label=\{etiquetaDeCategoria\(item\)\}/);
});

test('la etiqueta se arma en un solo sitio', () => {
  assert.match(fila, /export function etiquetaDeCategoria\(category\) \{/);
  assert.match(fila, /return toTitleCase\(translateProductCategory\(category\)\);/);
  // Parte por espacios, barras y guiones: "insignias-emblemas" -> "Insignias-Emblemas".
  assert.match(fila, /\.split\(\/\(\\s\+\|\\\/\|-\)\/\)/);
});
