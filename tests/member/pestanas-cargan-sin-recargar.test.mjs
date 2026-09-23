import fs from 'node:fs';
import test from 'node:test';
import path from 'node:path';
import assert from 'node:assert/strict';

// LAS PESTAÑAS DE LOS NIVELES CARGAN SIN RECARGAR LA PAGINA.
//
// Se rompia de dos formas, y las dos se arreglaban recargando —que es justo la
// señal de que el estado malo vivia en un modulo ya cargado—:
//
// 1. La estructura del padron se cacheaba EN UNA PROMESA, y el rechazo tambien.
//    Al primer fallo de la API, cada navegacion posterior reusaba esa promesa
//    rota y las pestañas del miembro se quedaban clavadas hasta recargar la
//    pagina entera, que era lo unico que volvia a crear el modulo.
//
// 2. Quien decide si la ficha es tuya se quedaba en "resolviendo" si algo
//    lanzaba dentro, y el layout pintaba una pantalla vacia para siempre.
//    Colgarse es peor que cualquiera de las dos respuestas.

const leer = (relativa) => fs.readFileSync(path.join(process.cwd(), relativa), 'utf8');

test('una estructura que falla no se queda cacheada: la siguiente pestaña reintenta', () => {
  const servicio = leer('src/services/member-context-service.js');

  // El rechazo vacia la casilla de la cache...
  assert.match(servicio, /enCurso\.catch\(\(\) => \{[\s\S]*?memberDirectoryMetadataPromise = null;/);

  // ...pero solo si sigue siendo la suya, para no pisar una recarga mas nueva.
  assert.match(servicio, /if \(memberDirectoryMetadataPromise === enCurso\)/);
});

test('el refresco silencioso de la ficha no deja el rechazo sin dueño', () => {
  const servicio = leer('src/services/member-context-service.js');

  // Se devuelve la ficha cacheada y se refresca por detras; si ese refresco
  // falla, la pestaña ya pintada no se puede venir abajo por su culpa.
  assert.match(servicio, /void loadResolvedMember\([\s\S]*?\.catch\(\(\) => \{\}\)/);
});

test('el candado de alcance siempre responde si o no, nunca se queda colgado', () => {
  const candado = leer('src/sections/common/use-entidad-en-su-alcance.js');
  const region = leer('src/sections/regional/layout/regional-edit-layout.jsx');

  // Ante la duda, 'fuera': es como ya se responde cuando no hay id.
  assert.match(candado, /resolver\(\)\.catch\(\(\) => \{[\s\S]*?setEstado\('fuera'\);/);
  assert.match(region, /averiguar\(\)\.catch\(\(\) => \{[\s\S]*?setPuedeEntrar\(false\);/);
});

test('la cabecera del destacamento pasa por el servicio, no por un fetch a pelo', () => {
  const destacamento = leer('src/sections/dest/layout/dest-edit-layout.jsx');

  // El crudo no tenia try/catch: un 500 dejaba el rechazo sin dueño y el
  // encabezado clavado. El servicio ya reintenta contra el espejo local.
  assert.doesNotMatch(destacamento, /fetch\('\/api\/dest\/'\)/);
  assert.match(destacamento, /getDestsApi\(\{ includePhotos: false \}\)\.catch\(\(\) => \[\]\)/);
});

test('ninguna pestaña del miembro lanza su carga sin capturar el fallo', () => {
  const pestanas = [
    'src/app/dashboard/level/member/[id]/edit/page.jsx',
    'src/app/dashboard/level/member/[id]/edit/health/page.jsx',
    'src/app/dashboard/level/member/[id]/edit/awards/page.jsx',
    'src/app/dashboard/level/member/[id]/edit/parents/page.jsx',
    'src/app/dashboard/level/member/[id]/edit/history/page.jsx',
  ];

  pestanas.forEach((relativa) => {
    const pestana = leer(relativa);

    assert.match(pestana, /load\(\)\.catch\(\(\) => \{\}\);/, relativa);
    assert.doesNotMatch(pestana, /^ {4}load\(\);$/m, relativa);
  });
});
