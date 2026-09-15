import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

// UN SOLO DISENO DE LIDERES JUVENILES PARA TODOS LOS DESTACAMENTOS.
//
// El diseno del cuadro se guardaba con el id del destacamento: solo Tribu de
// Juda 18 tenia uno afinado y los demas —y los nuevos— salian con otra forma.
// Ahora se guarda una vez con una clave global y, mientras no exista, se lee el
// de Tribu de Juda 18 (231), sin escribir en su documento.
//
// Se lee el codigo como texto: el modulo de datos es `.js` con `export` y Node
// no lo carga fuera de Next (por eso falla tambien lideres-juveniles.test.mjs).

const leer = (ruta) => fs.readFileSync(new URL(`../../${ruta}`, import.meta.url), 'utf8');

const datos = leer('src/sections/dest/leadership/dest-youth-leadership-data.js');
const vista = leer('src/sections/dest/leadership/dest-youth-leadership-view.jsx');
const almacen = leer('src/sections/common/use-leadership-layout-storage.js');

test('el diseno juvenil se guarda con una clave global, no con el id del destacamento', () => {
  assert.match(datos, /export const ID_DISENO_JUVENIL_GLOBAL = 'global';/);
  assert.match(vista, /idEntidad:\s*ID_DISENO_JUVENIL_GLOBAL/);
  assert.doesNotMatch(vista, /idEntidad:\s*destId \? String\(destId\)/);
});

test('sin diseno global, todos leen el de Tribu de Juda 18 sin escribirlo', () => {
  assert.match(datos, /export const ID_DESTACAMENTO_MODELO_JUVENIL = '231';/);
  assert.match(vista, /idEntidadRespaldo:\s*ID_DESTACAMENTO_MODELO_JUVENIL/);
  // El respaldo solo se usa para leer: guardar va siempre a `idEntidad`.
  assert.match(almacen, /obtenerDisenoDirectiva\(\{ nivel, idEntidad: idEntidadRespaldo \}\)/);
  assert.doesNotMatch(almacen, /guardarDisenoDirectiva\([^)]*idEntidadRespaldo/);
});
