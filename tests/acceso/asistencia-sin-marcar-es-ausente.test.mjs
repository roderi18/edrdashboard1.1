import fs from 'node:fs';
import test from 'node:test';
import { register } from 'node:module';
import assert from 'node:assert/strict';

// El codigo REAL, no una replica: ver `tests/soporte/resolver-alias-src.mjs`.
register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

const { convertirEstadoAsistenciaAUi, convertirEstadoAsistenciaAFirebase } =
  await import('src/services/attendance-service.js');

const leer = (relativa) => fs.readFileSync(relativa, 'utf8');

const SERVICIO = leer('src/services/attendance-service.js');
const PANTALLA = leer('src/sections/attendance/view/attendance-quick-view.jsx');

// ----------------------------------------------------------------------
// A QUIEN NO SE MARCO SE LE GUARDA COMO AUSENTE.
//
// Al guardar el pase de lista, a quien nadie marco se le escribia
// `ausente_sin_marcar`: un cuarto estado. En pantalla se leia "Ausente" igual que
// el ausente de verdad —mismo texto, mismo ambar—, pero en el dato era otra cosa
// y `conteo.ausentes` no lo incluia.
//
// El efecto practico: un pase de lista en el que solo se marcan los presentes
// —que es como se pasa cuando hay prisa— se guardaba con CERO ausentes, y el
// informe del destacamento salia diciendo que no falto nadie.
//
// Ahora una ausencia es una ausencia, la haya escrito una persona o el guardado.
// Lo que no se pierde es QUIEN la escribio: `marcadoManualmente` lo distingue.
// ----------------------------------------------------------------------

test('el estado sin marcar sigue existiendo para lo que ya esta guardado', () => {
  // No se borra del catalogo: hay registros escritos con el, y al leerlos la
  // pantalla tiene que seguir sabiendo interpretarlos.
  assert.equal(convertirEstadoAsistenciaAFirebase('absent-unmarked'), 'ausente_sin_marcar');
  assert.equal(convertirEstadoAsistenciaAUi('ausente_sin_marcar'), 'absent-unmarked');
});

test('al guardar, el sin marcar se convierte en ausente', () => {
  assert.match(SERVICIO, /const sinMarcar = estadoOriginal === 'ausente_sin_marcar';/);
  assert.match(SERVICIO, /const estado = sinMarcar \? 'ausente' : estadoOriginal;/);
});

test('esas ausencias SI cuentan como ausentes', () => {
  // La linea que las contaba aparte miraba `estado`, que ahora ya es 'ausente':
  // sin este cambio el contador de ausencias automaticas se quedaba en cero.
  assert.match(SERVICIO, /if \(estado === 'ausente'\) conteo\.ausentes \+= 1;/);
  assert.match(SERVICIO, /if \(sinMarcar\) conteo\.ausentesSinMarcar \+= 1;/);
});

test('se conserva quien puso la marca', () => {
  // El dato de calidad no se pierde: el estado dice "ausente", esta bandera dice
  // si lo escribio una persona o el guardado.
  assert.match(SERVICIO, /marcadoManualmente: !sinMarcar,/);
});

test('la pantalla queda mostrando lo mismo que se escribio', () => {
  // Sin esto, tras guardar la vista seguia con `absent-unmarked` hasta recargar y
  // el resumen contaba una cosa distinta de la que hay en Firebase.
  assert.match(PANTALLA, /estado === AUTO_ABSENT_STATUS \? 'absent' : estado/);
  assert.match(PANTALLA, /setStatusByMemberId\(estadosEscritos\);/);
  assert.match(PANTALLA, /setEstadosGuardados\(estadosEscritos\);/);
});

test('el filtro de ausentes sigue recogiendo a los dos', () => {
  // Mientras haya registros viejos con `absent-unmarked`, filtrar por "Ausente"
  // tiene que encontrarlos tambien.
  assert.match(PANTALLA, /status === 'absent' \|\| status === AUTO_ABSENT_STATUS/);
});
