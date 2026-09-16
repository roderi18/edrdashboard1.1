// ----------------------------------------------------------------------
// EL LECTOR DE LA PORTADA (`useContenidoDePortada`).
//
// Es el gancho con el que /principal pide cada bloque desde la fase 2. Lo que
// decide que se pinta —lo publicado o lo de fabrica— esta probado de verdad en
// `registro-y-lector.test.mjs`. Aqui se clava COMO lo pide el gancho, porque cada
// una de estas piezas evita un fallo concreto que la portada enseñaria a todos:
//
//   - Arranca con lo de fabrica. Si arrancara con la copia del navegador, el
//     primer pintado del servidor y el del navegador no casarian.
//   - La copia se aplica antes de pintar. Sin eso, con algo publicado, cada
//     visita enseñaria un instante lo viejo antes de cambiar.
//   - La copia pasa por el saneado. Tocarla a mano no cuela nada.
//   - "No se pudo leer" no es "no hay nada publicado". Con la red caida no se
//     tira la copia buena ni se vuelve a lo de fabrica.
// ----------------------------------------------------------------------

import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

const leer = (relativa) => fs.readFileSync(path.join(process.cwd(), relativa), 'utf8');

const LECTOR = leer('src/sections/principal/use-contenido-de-portada.js');

test('arranca con lo de fabrica, igual en el servidor que en el navegador', () => {
  assert.match(LECTOR, /useState\(\(\) => resolver\(null\)\)/);
  assert.match(
    LECTOR,
    /resolverPortada\(\{ publicado, fabrica: FABRICA_DE_PORTADA, pantalla: PANTALLA \}\)/
  );
});

test('la copia del navegador se aplica antes de pintar, y solo en el navegador', () => {
  assert.match(
    LECTOR,
    /const useEfectoAntesDePintar = typeof window === 'undefined' \? useEffect : useLayoutEffect;/
  );
  assert.match(LECTOR, /useEfectoAntesDePintar\(\(\) => \{\s*const copia = leerCopia\(\);/);
});

test('la copia pasa por el mismo saneado que lo leido de Firestore', () => {
  // No hay otro camino al estado que `resolver`, que es `resolverPortada`.
  const asignaciones = LECTOR.match(/setPortada\(([^)]*\))\)/g) ?? [];

  assert.ok(asignaciones.length >= 2);
  asignaciones.forEach((asignacion) => assert.match(asignacion, /setPortada\(resolver\(/));
});

test('si no se puede leer, se queda lo que habia y no se borra la copia', () => {
  assert.match(LECTOR, /obtenerPublicado\(PANTALLA, \{ lanzarSiFalla: true \}\)/);

  const alFallar = LECTOR.slice(LECTOR.indexOf('.catch(() => {'));

  assert.doesNotMatch(alFallar.slice(0, alFallar.indexOf('});')), /guardarCopia|setPortada/);

  // Y el servicio distingue de verdad los dos casos.
  const servicio = leer('src/services/everest-service.js');

  assert.match(servicio, /if \(lanzarSiFalla\) throw error;/);
  assert.match(servicio, /return documento\.exists\(\) \? documento\.data\(\) : null;/);
});

test('sin nada publicado no se guarda copia: la siguiente visita arranca con lo de siempre', () => {
  assert.match(LECTOR, /localStorage\.removeItem\(CLAVE_COPIA_DE_PORTADA\)/);
});

test('una sola lectura por visita, no una escucha en vivo', () => {
  assert.doesNotMatch(LECTOR, /onSnapshot/);
});

test('la marca "Ejemplo" no se pone sobre lo publicado', () => {
  const vista = leer('src/sections/principal/view/principal-home-view.jsx');

  assert.match(
    vista,
    /const esDeEjemplo = \(bloque\) => HAY_DATOS_DE_EJEMPLO && bloque\.origen === 'codigo';/
  );
  assert.doesNotMatch(vista, /esEjemplo=\{HAY_DATOS_DE_EJEMPLO\}/);
});
