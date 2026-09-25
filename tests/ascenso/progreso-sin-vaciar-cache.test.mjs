import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

// ABRIR LA PESTAÑA DE PREMIOS NO VACÍA LA CACHÉ DE LA APLICACIÓN.
//
// Traer el progreso de ascenso es una lectura, pero iba envuelta como escritura
// (`conInvalidacion` sin prefijos): cada vez que alguien abría la pestaña se
// olvidaba TODO lo leído (padrón, directivas, fotos…) y se avisaba a las demás
// sesiones para que vaciaran lo suyo. La aplicación entera volvía a pedirlo a la
// red y la propia pestaña nunca aprovechaba su caché. Además el progreso, que es
// de personas, no se borraba al cerrar sesión.

const { leerConCache, hayGuardado, invalidarLecturas } = await import(
  'src/utils/cache-de-lecturas.mjs'
);
const { hayProgresoEnCache, vaciarProgresoEnCache } = await import(
  'src/services/awards-progress-cache.js'
);
const { sincronizarProgresoAscensoFirebase } = await import(
  'src/services/member-awards-service.js'
);

const OTRA_LECTURA = 'regiones:listar:[]';

test.beforeEach(async () => {
  invalidarLecturas();
  vaciarProgresoEnCache();
  await leerConCache(OTRA_LECTURA, async () => ['una región']);
});

test('sincronizar el progreso deja intacto lo que otras pantallas ya leyeron', async () => {
  await sincronizarProgresoAscensoFirebase('123');

  assert.equal(hayGuardado(OTRA_LECTURA), true);
  assert.equal(hayProgresoEnCache('123'), true);
});

test('la segunda visita reutiliza la lectura del progreso en vez de repetirla', async () => {
  await sincronizarProgresoAscensoFirebase('123');

  assert.equal(hayGuardado('ascenso:listarProgresoAscensoMiembro:["123"]'), true);
});

test('tras aprobar una solicitud (`fresco`) se relee el progreso, y solo el progreso', async () => {
  await leerConCache('ascenso:otra', async () => 'vieja');

  await sincronizarProgresoAscensoFirebase('123', { fresco: true });

  assert.equal(hayGuardado('ascenso:otra'), false);
  assert.equal(hayGuardado(OTRA_LECTURA), true);
});

test('cerrar sesión borra el progreso de la memoria', async () => {
  await sincronizarProgresoAscensoFirebase('123');

  vaciarProgresoEnCache();

  assert.equal(hayProgresoEnCache('123'), false);
});
