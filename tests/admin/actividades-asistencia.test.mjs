import fs from 'node:fs';
import test from 'node:test';
import { register } from 'node:module';
import assert from 'node:assert/strict';

// El codigo REAL, por el mismo alias con el que lo importa la aplicacion.
register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

// ACTIVIDADES EN EL CALENDARIO DE ASISTENCIA.
//
// El calendario solo abria el dia de reunion y nunca un dia futuro: no habia
// forma de pasar lista en una excursion o un servicio otro dia, ni en una
// actividad de tres dias que empieza mañana. Ahora "Agregar actividad" guarda
// un dia o un rango, y esos dias se abren siempre.
//
// Y el pase de lista se perdia si nadie pulsaba "Guardar asistencia": ahora
// cada marca se guarda sola.

const {
  diasDelRango,
  ordenarRango,
  actividadEnFecha,
  fechasConActividad,
  fechaSeleccionable,
  motivoRangoInvalido,
  MAX_DIAS_ACTIVIDAD,
  corregirFechaDeAsistencia,
} = await import('src/utils/actividades-asistencia.mjs');

// Martes 15 de septiembre de 2026; el destacamento se reune los sabados (6).
const HOY = '2026-09-15';
const SABADO = 6;

test('una actividad de hoy a tres dias abre esos dias futuros', () => {
  const conActividad = fechasConActividad([{ fechaInicio: HOY, fechaFin: '2026-09-18' }]);

  ['2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18'].forEach((fecha) => {
    assert.equal(
      fechaSeleccionable({ fecha, hoy: HOY, diaDeReunion: SABADO, conActividad }),
      true,
      `${fecha} deberia poder abrirse`
    );
  });

  assert.equal(
    fechaSeleccionable({ fecha: '2026-09-19', hoy: HOY, diaDeReunion: SABADO, conActividad }),
    false,
    'el sabado siguiente todavia no llego'
  );
});

test('el calendario encuentra el nombre de la actividad que cubre cada dia', () => {
  const actividad = {
    id: 'actividad-1',
    nombre: 'Campamento nacional',
    fechaInicio: '2026-09-17',
    fechaFin: '2026-09-19',
  };

  assert.equal(actividadEnFecha([actividad], '2026-09-18'), actividad);
  assert.equal(actividadEnFecha([actividad], '2026-09-20'), null);
});

test('sin actividad siguen mandando el dia de reunion y que el dia haya llegado', () => {
  const vacio = new Set();

  assert.equal(
    fechaSeleccionable({
      fecha: '2026-09-12',
      hoy: HOY,
      diaDeReunion: SABADO,
      conActividad: vacio,
    }),
    true
  );
  assert.equal(
    fechaSeleccionable({
      fecha: '2026-09-14',
      hoy: HOY,
      diaDeReunion: SABADO,
      conActividad: vacio,
    }),
    false
  );
});

test('la fecha de una actividad futura no se corrige hacia atras', () => {
  const conActividad = fechasConActividad([{ fechaInicio: '2026-09-17', fechaFin: '2026-09-17' }]);

  assert.equal(
    corregirFechaDeAsistencia({
      fecha: '2026-09-17',
      hoy: HOY,
      diaDeReunion: SABADO,
      conActividad,
    }),
    '2026-09-17'
  );
  // Un dia cualquiera sin actividad vuelve al ultimo sabado celebrado.
  assert.equal(
    corregirFechaDeAsistencia({ fecha: '2026-09-16', hoy: HOY, diaDeReunion: SABADO }),
    '2026-09-12'
  );
});

test('el rango se ordena aunque se pulse primero el ultimo dia, y tiene un tope', () => {
  assert.deepEqual(ordenarRango('2026-09-18', '2026-09-15'), {
    fechaInicio: '2026-09-15',
    fechaFin: '2026-09-18',
  });
  assert.deepEqual(diasDelRango('2026-10-31', '2026-11-02'), [
    '2026-10-31',
    '2026-11-01',
    '2026-11-02',
  ]);
  assert.equal(motivoRangoInvalido('2026-09-15', '2026-09-15'), '');
  assert.match(
    motivoRangoInvalido('2026-01-01', '2026-03-01'),
    new RegExp(`${MAX_DIAS_ACTIVIDAD}`)
  );
});

test('la regla de actividadesAsistencia existe y el comodin no la abre', () => {
  const reglas = fs.readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8');

  assert.match(reglas, /match \/actividadesAsistencia\/\{idActividad\}/);
  assert.match(reglas, /allow delete: if esUsuarioDelSistema\(\);/);
  assert.match(reglas, /&& coleccion != 'actividadesAsistencia'/);
});

test('crear una actividad pide nombre y la vista permite eliminarla', () => {
  const servicio = fs.readFileSync(
    new URL('../../src/services/attendance-service.js', import.meta.url),
    'utf8'
  );
  const vista = fs.readFileSync(
    new URL('../../src/sections/attendance/view/attendance-quick-view.jsx', import.meta.url),
    'utf8'
  );

  assert.match(servicio, /Escribe el nombre de la actividad/);
  assert.match(servicio, /export const eliminarActividadAsistencia/);
  assert.match(vista, /label="Nombre de la actividad"/);
  assert.match(vista, /title="Eliminar actividad"/);
  assert.match(vista, /enterTouchDelay=\{0\}/);
});

test('la asistencia se guarda sola, sin pulsar el boton', () => {
  const vista = fs.readFileSync(
    new URL('../../src/sections/attendance/view/attendance-quick-view.jsx', import.meta.url),
    'utf8'
  );

  assert.match(vista, /guardarInstantanea\(foto, \{ automatico: true \}\)/);
  // Lo pendiente se guarda al cambiar de fecha o de destacamento.
  assert.match(vista, /\[date, selectedDestId\]\s*\);/);
});
