// ----------------------------------------------------------------------
// LOS CAMPOS NUEVOS DE LOS EDITORES, Y LO QUE SE CALCULA AL PINTAR (fase 4).
//
// Lo que se rompia sin esto:
//
//   - Los "días que faltan" eran un numero escrito a mano: al dia siguiente de
//     publicarlo ya era mentira. Con fecha de inicio, se calculan al pintar.
//   - Un evento que ya paso seguia en "Próximos eventos" hasta que alguien lo
//     quitara.
//   - Y la condicion de siempre: el valor de fabrica no trae ninguno de estos
//     campos, asi que tiene que seguir pasando el saneado tal cual y pintandose
//     igual —el mismo objeto—.
// ----------------------------------------------------------------------

import test from 'node:test';
import { register } from 'node:module';
import assert from 'node:assert/strict';

register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

const { FABRICA_DE_PORTADA } = await import('src/sections/principal/fabrica-de-portada.js');
const { bloquePorId } = await import('src/utils/everest/bloques.mjs');
const { medio, boton, fechaISO, conOpcionales } = await import('src/utils/everest/saneado.mjs');
const {
  hoyISO,
  diaYMes,
  diasHasta,
  fechaCorta,
  textoDeFechas,
  eventosVigentes,
  actividadParaPintar,
} = await import('src/utils/everest/presentacion.mjs');

const sanear = (idBloque, contenido) => bloquePorId(idBloque).sanear(contenido);

const ACTIVIDAD = {
  titulo: 'Investidura Nacional 2026',
  lugar: 'Santiago de los Caballeros',
  estado: 'Inscripciones abiertas',
};

const URL_DE_STORAGE =
  'https://firebasestorage.googleapis.com/v0/b/proyecto/o/everest%2Fx.webp?alt=media';

// ----------------------------------------------------------------------
// LAS PIEZAS
// ----------------------------------------------------------------------

test('fechaISO: solo fechas que existen', () => {
  assert.equal(fechaISO('2026-09-26'), '2026-09-26');
  assert.equal(fechaISO('2026-02-31'), null);
  assert.equal(fechaISO('26/09/2026'), null);
  assert.equal(fechaISO('2026-9-6'), null);
  assert.equal(fechaISO(undefined), null);
});

test('medio: https, y solo los tipos que admite la tarjeta', () => {
  assert.deepEqual(medio({ url: URL_DE_STORAGE, tipo: 'imagen' }), {
    url: URL_DE_STORAGE,
    tipo: 'imagen',
  });
  assert.equal(medio({ url: URL_DE_STORAGE, tipo: 'video' }, { tipos: ['imagen'] }), null);
  // Una ruta interna no es un archivo: el fondo tiene que ser una direccion completa.
  assert.equal(medio({ url: '/logo.png', tipo: 'imagen' }), null);
  assert.equal(medio({ url: 'http://inseguro.test/x.webp', tipo: 'imagen' }), null);
});

test('boton: texto corto y destino valido', () => {
  assert.deepEqual(boton({ texto: ' Inscribirme ', destino: '/dashboard/calendar' }), {
    texto: 'Inscribirme',
    destino: '/dashboard/calendar',
  });
  assert.equal(boton({ texto: '', destino: '/dashboard/calendar' }), null);
  assert.equal(boton({ texto: 'Ir', destino: 'javascript:void(0)' }), null);
});

test('conOpcionales: lo ausente no se añade, lo roto invalida', () => {
  const base = { titulo: 'x' };

  assert.deepEqual(conOpcionales(base, {}, { fecha: fechaISO }), { titulo: 'x' });
  assert.ok(!('fecha' in conOpcionales(base, {}, { fecha: fechaISO })));
  assert.deepEqual(conOpcionales(base, { fecha: '2026-01-02' }, { fecha: fechaISO }), {
    titulo: 'x',
    fecha: '2026-01-02',
  });
  assert.equal(conOpcionales(base, { fecha: 'mañana' }, { fecha: fechaISO }), null);
  assert.equal(conOpcionales(null, {}, { fecha: fechaISO }), null);
});

// ----------------------------------------------------------------------
// LOS BLOQUES CON SUS CAMPOS NUEVOS
// ----------------------------------------------------------------------

test('el valor de fabrica sigue pasando su saneado sin ganar ningun campo', () => {
  ['bienvenida', 'proxima-actividad', 'proximos-eventos'].forEach((idBloque) => {
    const copia = JSON.parse(JSON.stringify(FABRICA_DE_PORTADA[idBloque]));

    assert.deepEqual(sanear(idBloque, copia), FABRICA_DE_PORTADA[idBloque], idBloque);
  });
});

test('con fecha de inicio, la actividad ya no necesita fechas ni dias escritos a mano', () => {
  assert.deepEqual(sanear('proxima-actividad', { ...ACTIVIDAD, fechaInicio: '2026-11-14' }), {
    ...ACTIVIDAD,
    fechaInicio: '2026-11-14',
  });
  // Sin fecha de inicio, siguen siendo obligatorios.
  assert.equal(sanear('proxima-actividad', ACTIVIDAD), null);
});

test('una actividad no puede terminar antes de empezar, ni tener fin sin inicio', () => {
  assert.equal(
    sanear('proxima-actividad', {
      ...ACTIVIDAD,
      fechaInicio: '2026-11-14',
      fechaFin: '2026-11-13',
    }),
    null
  );
  assert.equal(
    sanear('proxima-actividad', {
      ...FABRICA_DE_PORTADA['proxima-actividad'],
      fechaFin: '2026-11-13',
    }),
    null
  );
});

test('la actividad admite fondo en imagen o video y un boton propio', () => {
  const limpia = sanear('proxima-actividad', {
    ...ACTIVIDAD,
    fechaInicio: '2026-11-14',
    fondo: { url: URL_DE_STORAGE, tipo: 'video' },
    boton: { texto: 'Inscribirme', destino: '/dashboard/calendar' },
  });

  assert.equal(limpia.fondo.tipo, 'video');
  assert.equal(limpia.boton.texto, 'Inscribirme');
});

test('la bienvenida admite fondo de imagen, pero no de video', () => {
  const bienvenida = FABRICA_DE_PORTADA.bienvenida;

  assert.equal(
    sanear('bienvenida', { ...bienvenida, fondo: { url: URL_DE_STORAGE, tipo: 'imagen' } }).fondo
      .tipo,
    'imagen'
  );
  assert.equal(
    sanear('bienvenida', { ...bienvenida, fondo: { url: URL_DE_STORAGE, tipo: 'video' } }),
    null
  );
});

test('un evento con fecha la conserva; con una fecha rota, invalida la lista', () => {
  const evento = { ...FABRICA_DE_PORTADA['proximos-eventos'][0], fecha: '2026-09-26' };

  assert.equal(sanear('proximos-eventos', [evento])[0].fecha, '2026-09-26');
  assert.equal(sanear('proximos-eventos', [{ ...evento, fecha: '2026-13-01' }]), null);
});

// ----------------------------------------------------------------------
// LO QUE SE CALCULA AL PINTAR
// ----------------------------------------------------------------------

test('los dias que faltan se cuentan en dias de calendario, y nunca en negativo', () => {
  assert.equal(diasHasta('2026-09-26', '2026-09-13'), 13);
  assert.equal(diasHasta('2026-09-26', '2026-09-26'), 0);
  assert.equal(diasHasta('2026-09-26', '2026-10-01'), 0);
  // Cruzando un año bisiesto.
  assert.equal(diasHasta('2028-03-01', '2028-02-28'), 2);
});

test('hoy es el dia de la Republica Dominicana, no el de Greenwich', () => {
  // 02:00 UTC del 17 son las 22:00 del 16 en Santo Domingo.
  assert.equal(hoyISO(new Date('2026-09-17T02:00:00.000Z')), '2026-09-16');
  assert.equal(hoyISO(new Date('2026-09-17T05:00:00.000Z')), '2026-09-17');
});

test('el texto de las fechas imita al de fabrica', () => {
  assert.equal(textoDeFechas('2026-09-26', '2026-09-28'), '26 — 28 septiembre 2026');
  assert.equal(textoDeFechas('2026-09-26'), '26 septiembre 2026');
  assert.equal(textoDeFechas('2026-09-30', '2026-10-02'), '30 septiembre — 2 octubre 2026');
  assert.equal(textoDeFechas('2026-12-30', '2027-01-02'), '30 diciembre 2026 — 2 enero 2027');
  assert.equal(fechaCorta('2026-09-05'), '05 sep 2026');
  assert.deepEqual(diaYMes('2026-10-03'), { dia: '03', mes: 'OCT' });
});

test('sin fecha de inicio, la actividad se pinta como vino: el mismo objeto', () => {
  const fabrica = FABRICA_DE_PORTADA['proxima-actividad'];

  assert.equal(actividadParaPintar(fabrica, '2026-09-16'), fabrica);
});

test('con fecha de inicio, las fechas y los dias salen del calendario', () => {
  const pintada = actividadParaPintar(
    { ...ACTIVIDAD, fechaInicio: '2026-09-26', fechaFin: '2026-09-28' },
    '2026-09-16'
  );

  assert.equal(pintada.fechas, '26 — 28 septiembre 2026');
  assert.equal(pintada.diasQueFaltan, 10);
});

test('los eventos que ya pasaron se dejan de enseñar; sin fechas, la lista es la misma', () => {
  const fabrica = FABRICA_DE_PORTADA['proximos-eventos'];

  assert.equal(eventosVigentes(fabrica, '2027-01-01'), fabrica);

  const conFechas = [
    { clave: 'pasado', fecha: '2026-09-01' },
    { clave: 'hoy', fecha: '2026-09-16' },
    { clave: 'sin-fecha' },
  ];

  assert.deepEqual(
    eventosVigentes(conFechas, '2026-09-16').map((evento) => evento.clave),
    ['hoy', 'sin-fecha']
  );
});
