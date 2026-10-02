// ----------------------------------------------------------------------
// LAS FOTOS DE LA TIENDA SE GUARDAN EN EL NAVEGADOR Y CARGA PRIMERO LO VISIBLE.
//
// Qué se rompía: con "Filas por página: Todos" las fotos tardaban mucho. Las
// subidas por los scripts de alta no llevaban `cacheControl` y Storage las
// servía con `max-age=0` (se volvían a pedir en cada visita), y cada foto se
// pedía solo al entrar justo en la pantalla.
// ----------------------------------------------------------------------

import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

const leer = (ruta) => readFileSync(new URL(`../../${ruta}`, import.meta.url), 'utf8');

test('los scripts de alta de productos suben las fotos con caché de un año', () => {
  const carpeta = 'scripts/alta-productos';
  const scripts = readdirSync(new URL(`../../${carpeta}`, import.meta.url)).filter((nombre) =>
    nombre.endsWith('.mjs')
  );

  scripts
    .map((nombre) => [nombre, leer(`${carpeta}/${nombre}`)])
    .filter(([, codigo]) => codigo.includes("contentType: 'image/webp'"))
    .forEach(([nombre, codigo]) => {
      assert.match(codigo, /cacheControl: 'public, max-age=31536000, immutable'/, nombre);
    });
});

test('la tarjeta precarga las fotos cercanas y prioriza la primera pantalla', () => {
  const tarjeta = leer('src/sections/product/product-grid-card.jsx');
  const lista = leer('src/sections/product/view/product-list-view.jsx');

  assert.match(tarjeta, /viewportOptions=\{\{ margin: MARGEN_DE_PRECARGA \}\}/);
  assert.match(tarjeta, /fetchPriority: 'high'/);
  assert.match(lista, /prioritaria=\{indice < FOTOS_PRIORITARIAS\}/);
});
