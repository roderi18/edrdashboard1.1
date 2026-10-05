// ----------------------------------------------------------------------
// LA SALUD DEL SISTEMA SE REVISA SOLA Y AVISA.
//
// Qué se rompía: la revisión vivía en la pantalla `/dashboard/admin/health` y
// solo corría al abrirla; un fallo no avisaba hasta que alguien entraba. Se
// pidió: todos los días a las 4:00 p. m. revisar conexiones, módulos, Firebase,
// la API y sus almacenamientos, y mandar un resumen corto al chat de los
// Administradores Globales; y cualquier error, cuando sea, a su campana y al chat.
// ----------------------------------------------------------------------

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import '../soporte/resolver-alias-src.mjs';

const {
  avisosDeSalud,
  fechaClaveSalud,
  estadoGeneralSalud,
  sanearChequeoSalud,
  idAvisoDeChequeoSalud,
  textoResumenDiarioSalud,
  textoAvisoDeFallasSalud,
} = await import('../../src/utils/salud-sistema.mjs');
const { TAREAS_PROGRAMADAS } = await import('../../src/utils/tareas-programadas.mjs');

const leer = (ruta) => readFileSync(new URL(`../../${ruta}`, import.meta.url), 'utf8');

const bien = (id, resumen) => ({ id, area: 'X', name: id, status: 'correcto', resumen });
const falla = (id, detalle) => ({
  id,
  area: 'X',
  name: id,
  status: 'critico',
  detail: detalle,
  resumen: detalle,
});
const aviso = (id) => ({ id, area: 'X', name: id, status: 'advertencia', resumen: 'lento' });

test('la diaria es a las 4:00 p. m. de Santo Domingo y la de cada hora no la repite', () => {
  const diaria = TAREAS_PROGRAMADAS.find((t) => t.id === 'salud-sistema-diaria');
  const cadaHora = TAREAS_PROGRAMADAS.find((t) => t.id === 'salud-sistema-cada-hora');

  assert.equal(diaria.horario, '0 16 * * *');
  assert.equal(diaria.zonaHoraria, 'America/Santo_Domingo');
  assert.equal(cadaHora.horario, '0 0-15,17-23 * * *');
  assert.match(
    leer('src/app/api/tareas/salud-sistema-diaria/route.js'),
    /responderRevisionDeSalud\('diaria'\)/
  );
  assert.match(
    leer('src/app/api/tareas/salud-sistema-cada-hora/route.js'),
    /responderRevisionDeSalud\('cada-hora'\)/
  );
});

test('un fallo va a la campana y al chat; una advertencia, solo a la campana', () => {
  const chequeos = [bien('a'), aviso('b'), falla('c', 'no responde')];
  const { campana, chat } = avisosDeSalud(chequeos);

  assert.deepEqual(
    campana.map((c) => c.id),
    ['b', 'c']
  );
  assert.deepEqual(
    chat.map((c) => c.id),
    ['c']
  );
  assert.deepEqual(avisosDeSalud([bien('a')]), { campana: [], chat: [] });
});

test('cada chequeo avisa una vez por día, con el mismo id que usaba la pantalla', () => {
  const dia = fechaClaveSalud(new Date('2026-10-02T23:30:00Z'));

  // 23:30 UTC son las 7:30 p. m. del mismo día en Santo Domingo.
  assert.equal(dia, '2026-10-02');
  assert.equal(
    idAvisoDeChequeoSalud('api_miembros', dia),
    'salud_sistema_alerta_api_miembros_2026-10-02'
  );
});

test('el estado general es el peor de los chequeos', () => {
  assert.equal(estadoGeneralSalud([bien('a'), aviso('b')]).status, 'advertencia');
  assert.equal(estadoGeneralSalud([aviso('b'), falla('c', 'x')]).status, 'critico');
  assert.equal(estadoGeneralSalud([bien('a')]).status, 'correcto');
});

test('el resumen es corto: primero los fallos, luego los avisos, luego lo que va bien', () => {
  const texto = textoResumenDiarioSalud({
    chequeos: [
      bien('Firestore', 'escribe y lee en 1,0 s'),
      aviso('API'),
      falla('Respaldo', 'hace 41 días'),
    ],
    fecha: new Date('2026-10-02T20:00:00Z'),
  });
  const lineas = texto.split('\n');

  assert.match(lineas[0], /^🩺 Salud del sistema · viernes,? 2 de octubre$/);
  assert.match(lineas[1], /Crítico \(1 fallo, 1 aviso\)/);
  assert.equal(lineas[3], '🔴 Respaldo: hace 41 días');
  assert.equal(lineas[4], '⚠️ API: lento');
  assert.equal(lineas[5], '✅ Firestore: escribe y lee en 1,0 s');
  assert.match(texto, /Revisado a las 4:00/);
});

test('el aviso de fallo dice qué falla y quién lo detectó', () => {
  const texto = textoAvisoDeFallasSalud({
    fallas: [falla('API de Miembros', 'no responde (sin respuesta tras 20 s)')],
    origen: 'pantalla',
  });

  assert.match(texto, /^🔴 Fallo en el sistema/);
  assert.match(texto, /🔴 API de Miembros: no responde/);
  assert.match(texto, /Detectado al abrir Salud del sistema/);
});

test('lo que manda la pantalla se sanea: estado válido y textos con tope', () => {
  const limpio = sanearChequeoSalud({ id: 'x', status: 'inventado', detail: 'a'.repeat(900) });

  assert.equal(limpio.status, 'correcto');
  assert.equal(limpio.detail.length, 300);
});

test('la pantalla ya no crea sus avisos sola: los manda al servidor, que escribe como Sistema', () => {
  const servicio = leer('src/services/admin-system-health-service.js');
  const ruta = leer('src/app/api/admin/salud-sistema/avisar/route.js');

  assert.doesNotMatch(servicio, /crearNotificacionSaludSistemaAlerta\(/);
  assert.match(servicio, /\/api\/admin\/salud-sistema\/avisar/);
  assert.match(ruta, /Solo el Administrador Global/);
});

test('las revisiones guardadas las escribe solo el servidor y las lee el Administrador Global', () => {
  const reglas = leer('firestore.rules');

  ['salud_sistema', 'salud_sistema_revisiones'].forEach((coleccion) => {
    assert.match(
      reglas,
      new RegExp(
        `match /${coleccion}/\\{[a-zA-Z]+\\} \\{\\s*allow read: if esAdministradorGlobal\\(\\);\\s*allow write: if false;`
      )
    );
    assert.match(reglas, new RegExp(`coleccion != '${coleccion}'`));
  });
});
