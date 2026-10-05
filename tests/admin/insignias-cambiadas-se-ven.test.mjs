// ----------------------------------------------------------------------
// UNA INSIGNIA CAMBIADA CON EL MISMO NOMBRE SE VE SIN BORRAR NADA A MANO.
//
// Qué se rompía: al cambiar un número dorado en
// `public/insignias/numeros-cintas` (mismo nombre de archivo) no se veía el
// nuevo. Las imágenes de `/insignias/` iban con `max-age=86400`: un día sin
// preguntar al servidor; y la renovación del service worker también la
// contestaba esa caché.
// ----------------------------------------------------------------------

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const leer = (ruta) => readFileSync(new URL(`../../${ruta}`, import.meta.url), 'utf8');

test('en desarrollo se pregunta siempre y en producción como mucho cada 5 minutos', () => {
  const config = leer('next.config.mjs');

  assert.doesNotMatch(config, /max-age=86400/);
  assert.match(config, /process\.env\.NODE_ENV === 'development'\s*\? 'no-cache'/);
  assert.match(config, /'public, max-age=300, stale-while-revalidate=604800'/);
});

test('el service worker renueva preguntando al servidor, no a la caché del navegador', () => {
  assert.match(leer('public/sw.js'), /const renovar = fetch\(request, \{ cache: 'no-cache' \}\)/);
});
