import fs from 'node:fs';
import test from 'node:test';
import { register } from 'node:module';
import assert from 'node:assert/strict';

// El codigo REAL, por el mismo alias con el que lo importa la aplicacion.
register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

// ----------------------------------------------------------------------
// EL RESUMEN DIARIO DE DESTACAMENTOS ACTUALIZADOS.
//
// Cada día a las 9:00 de Santo Domingo se avisa (campana y push) de cuántos
// destacamentos han enviado su información desde la landing de registro. Lo que
// no puede romperse: un destacamento que envía dos veces cuenta UNA (igual que
// el mapa de la landing), la hora es la de Santo Domingo y el aviso es uno por
// día aunque la tarea corra dos veces.
// ----------------------------------------------------------------------

const {
  claveDeDestacamento,
  textoDelResumen,
  fechaEnSantoDomingo,
  construirAvisoDeResumen,
  contarDestacamentosActualizados,
} = await import('../../src/utils/resumen-actualizaciones-destacamentos.mjs');

test('un destacamento que envía dos veces cuenta una sola vez', () => {
  const conteo = contarDestacamentosActualizados([
    { destacamento: { id: '18' } },
    { destacamento: { id: '18' } },
    { destacamento: { id: 18 } },
    { destacamento: { id: '52' } },
  ]);

  assert.deepEqual(conteo, { destacamentos: 2, envios: 4 });
});

test('los nuevos (sin id) se reconocen por sección y nombre, sin tildes ni mayúsculas', () => {
  assert.equal(
    claveDeDestacamento({ destacamento: { id: null, nombre: 'Los  Piños' }, seccion: { id: 7 } }),
    claveDeDestacamento({ destacamento: { id: null, nombre: 'los pinos' }, seccion: { id: '7' } })
  );
  assert.notEqual(
    claveDeDestacamento({ destacamento: { nombre: 'Los Pinos' }, seccion: { id: 7 } }),
    claveDeDestacamento({ destacamento: { nombre: 'Los Pinos' }, seccion: { id: 8 } })
  );
});

test('la fecha del aviso es la de Santo Domingo, no la UTC', () => {
  // 02:00 UTC del día 13 son las 22:00 del día 12 en Santo Domingo.
  assert.equal(fechaEnSantoDomingo(new Date('2026-10-13T02:00:00Z')), '2026-10-12');
  assert.equal(fechaEnSantoDomingo(new Date('2026-10-13T13:00:00Z')), '2026-10-13');
});

test('el aviso es uno por día: el id lleva la fecha y abre la bandeja', () => {
  const aviso = construirAvisoDeResumen({
    conteo: { destacamentos: 3, envios: 5 },
    idsDestinatarios: ['a'],
    ahora: new Date('2026-10-01T13:00:00Z'),
  });

  assert.equal(aviso.id, 'resumen_actualizaciones_destacamentos_2026-10-01');
  assert.equal(aviso.mensaje, 'Hasta el momento, 3 destacamentos han actualizado su información.');
  assert.equal(aviso.ruta, '/dashboard/admin/actualizaciones-destacamentos');
  assert.equal(
    textoDelResumen({ destacamentos: 1 }),
    'Hasta el momento, 1 destacamento ha actualizado su información.'
  );
});

test('la función programada corre a las 9:00 de Santo Domingo (13:00 UTC)', () => {
  const fuente = fs.readFileSync(
    new URL('../../netlify/functions/resumen-actualizaciones-diario.mjs', import.meta.url),
    'utf8'
  );

  assert.match(fuente, /schedule:\s*'0 13 \* \* \*'/);
});
