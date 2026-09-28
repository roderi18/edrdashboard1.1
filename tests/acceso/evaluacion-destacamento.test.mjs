import fs from 'node:fs';
import test from 'node:test';
import path from 'node:path';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

// LA PESTAÑA "EVALUACIÓN" DEL DESTACAMENTO.
//
// No. de evaluación, fecha de evaluación y fecha de entrega del reconocimiento.
// Los ven y los cambian SOLO el Administrador Global y la Oficina Nacional: la
// pestaña no sale a nadie más, la pantalla lo vuelve a comprobar, y las reglas de
// Firestore cierran la colección al resto. Las fechas se guardan como día
// ("AAAA-MM-DD") para que no se corran por la zona horaria.

const leer = (relativa) => fs.readFileSync(path.join(process.cwd(), relativa), 'utf8');

const { puedeVerEvaluacionDeDestacamento } = await import('../../src/utils/org-level-access.js');
const { normalizarEvaluacion, cambiosDeEvaluacion } = await import(
  '../../src/utils/evaluacion-destacamento.mjs'
);

const conRol = (rolId) => ({ uid: 'u', rolId, cargos: [] });

test('solo la ven la Oficina Nacional y el Administrador Global', () => {
  assert.equal(puedeVerEvaluacionDeDestacamento(conRol('administrador_global')), true);
  assert.equal(puedeVerEvaluacionDeDestacamento(conRol('oficina_nacional')), true);
  ['director_nacional', 'coordinador_seccional', 'coordinador_regional', 'usuario_destacamento'].forEach(
    (rolId) => assert.equal(puedeVerEvaluacionDeDestacamento(conRol(rolId)), false, rolId)
  );
});

test('la pestaña se oculta a quien no puede verla', () => {
  const layout = leer('src/sections/dest/layout/dest-edit-layout.jsx');
  assert.match(layout, /label: 'Evaluación'[\s\S]*?oculto: !puedeVerEvaluacionDeDestacamento\(user\)/);
});

test('las reglas de Firestore cierran la colección al resto', () => {
  const reglas = leer('firestore.rules');
  assert.match(
    reglas,
    /match \/evaluaciones_destacamentos\/\{idDestacamento\} \{\s*allow read, write: if esAdministradorGlobal\(\)\s*\|\| esOficinaNacional\(\)/
  );
});

test('las fechas se guardan como día y lo que no cuadra queda vacío', () => {
  assert.deepEqual(
    normalizarEvaluacion({ numeroEvaluacion: ' 12 ', fechaEvaluacion: '2026-09-28', fechaEntregaReconocimiento: '28/09/2026' }),
    { numeroEvaluacion: '12', fechaEvaluacion: '2026-09-28', fechaEntregaReconocimiento: '', nota: '' }
  );
  assert.deepEqual(normalizarEvaluacion(), {
    numeroEvaluacion: '',
    fechaEvaluacion: '',
    fechaEntregaReconocimiento: '',
    nota: '',
  });
});

test('la nota guarda los otros teléfonos del pastor', () => {
  const nota = 'Otros teléfonos del pastor: 809-506-7257, 849-210-7257';
  assert.equal(normalizarEvaluacion({ nota: `  ${nota}  ` }).nota, nota);
  assert.deepEqual(cambiosDeEvaluacion({}, { nota }), [
    { campo: 'nota', etiqueta: 'Nota', antes: null, despues: nota },
  ]);
});

test('Historial recibe solo los campos que cambian', () => {
  const cambios = cambiosDeEvaluacion(
    { numeroEvaluacion: '1', fechaEvaluacion: '2026-01-10' },
    { numeroEvaluacion: '2', fechaEvaluacion: '2026-01-10' }
  );
  assert.deepEqual(cambios, [
    { campo: 'numeroEvaluacion', etiqueta: 'No. de Evaluación', antes: '1', despues: '2' },
  ]);
});
