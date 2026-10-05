// ----------------------------------------------------------------------
// LAS TAREAS DIARIAS VIVEN EN /api/tareas Y SOLO RESPONDEN CON EL SECRETO.
//
// Qué se rompía: los avisos de cumpleaños y el resumen diario eran funciones
// programadas de Netlify. Al dejar Netlify por App Hosting nadie las lanzaba.
// Ahora son rutas que llama Cloud Scheduler; como son públicas, sin el secreto
// cualquiera podría repetir los avisos de cumpleaños.
// ----------------------------------------------------------------------

import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const { TAREAS_PROGRAMADAS, secretoDeTareaValido } =
  await import('../../src/utils/tareas-programadas.mjs');

const existe = (ruta) => fs.existsSync(new URL(`../../${ruta}`, import.meta.url));
const leer = (ruta) => fs.readFileSync(new URL(`../../${ruta}`, import.meta.url), 'utf8');

test('cumpleaños a las 7:00 y resumen a las 9:00, hora de Santo Domingo', () => {
  const porId = Object.fromEntries(TAREAS_PROGRAMADAS.map((tarea) => [tarea.id, tarea]));

  assert.equal(porId['cumpleanos-diarios'].horario, '0 7 * * *');
  assert.equal(porId['resumen-actualizaciones-diario'].horario, '0 9 * * *');
  TAREAS_PROGRAMADAS.forEach((tarea) => assert.equal(tarea.zonaHoraria, 'America/Santo_Domingo'));
});

test('cada tarea tiene su ruta y la ruta exige el secreto', () => {
  TAREAS_PROGRAMADAS.forEach((tarea) => {
    const ruta = `src/app${tarea.ruta}/route.js`;

    assert.ok(existe(ruta), ruta);
    assert.match(leer(ruta), /secretoDeTareaValido\(/);
    assert.match(leer(ruta), /TAREAS_PROGRAMADAS_SECRETO/);
  });
});

test('sin secreto configurado o con uno distinto, nadie pasa', () => {
  assert.equal(secretoDeTareaValido('abc', ''), false);
  assert.equal(secretoDeTareaValido('', undefined), false);
  assert.equal(secretoDeTareaValido('abd', 'abc'), false);
  assert.equal(secretoDeTareaValido('abcd', 'abc'), false);
  assert.equal(secretoDeTareaValido('abc', 'abc'), true);
});

test('Netlify ya no está en el proyecto', () => {
  assert.equal(existe('netlify.toml'), false);
  assert.equal(existe('netlify'), false);
  assert.doesNotMatch(leer('apphosting.yaml'), /netlify\.app/);
  assert.match(leer('apphosting.yaml'), /TAREAS_PROGRAMADAS_SECRETO/);
});
