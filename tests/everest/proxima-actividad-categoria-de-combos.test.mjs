// ----------------------------------------------------------------------
// LA PRÓXIMA ACTIVIDAD GUARDA LA CATEGORÍA DE SUS COMBOS.
//
// Qué se rompía: los combos de "Inscribirme" se buscaban por el título de la
// actividad; al publicar "Campamento Regional Inquebrantables 2027" el botón
// volvió a mandar al calendario. Ahora el Designer deja elegir la categoría de
// la tienda. Es opcional: sin ella, todo sigue como antes.
// ----------------------------------------------------------------------

import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

const { bloquePorId } = await import('src/utils/everest/bloques.mjs');
const { PROXIMA_ACTIVIDAD_DE_EJEMPLO } = await import('src/sections/principal/datos-de-ejemplo.js');

const sanear = bloquePorId('proxima-actividad').sanear;

test('sin categoría, el bloque de fábrica queda igual', () => {
  assert.deepEqual(sanear(PROXIMA_ACTIVIDAD_DE_EJEMPLO), PROXIMA_ACTIVIDAD_DE_EJEMPLO);
});

test('una categoría válida se guarda; una rota devuelve el bloque a fábrica', () => {
  assert.equal(
    sanear({ ...PROXIMA_ACTIVIDAD_DE_EJEMPLO, categoriaCombos: 'campamento-regional-2026' })
      .categoriaCombos,
    'campamento-regional-2026'
  );
  assert.equal(sanear({ ...PROXIMA_ACTIVIDAD_DE_EJEMPLO, categoriaCombos: 'Con Espacios' }), null);
});

test('el diálogo usa la categoría y el editor la ofrece', () => {
  const leer = (ruta) => fs.readFileSync(new URL(`../../${ruta}`, import.meta.url), 'utf8');

  assert.match(
    leer('src/sections/principal/inscripcion-actividad-dialog.jsx'),
    /combosDeActividad\(products, actividad\?\.titulo, actividad\?\.categoriaCombos\)/
  );
  assert.match(
    leer('src/sections/everest/editores/editor-proxima-actividad.jsx'),
    /cambiar\('categoriaCombos'/
  );
});
