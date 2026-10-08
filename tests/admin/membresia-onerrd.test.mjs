// ----------------------------------------------------------------------
// LA CONFIGURACIÓN DE LA MEMBRESÍA ONERRD 2027 (pestaña ONERRD → "Membresía
// 2027 · landing"), que la landing de pago lee al momento.
//
// Qué se rompía o se podía romper:
// · los precios se escribían plan por plan y el desglose de la factura no
//   cuadraba con el total; ahora cada plan suma las piezas;
// · sin saber el registro 2026 se suponía un precio (se cobraba de más o de
//   menos);
// · "025", "#25" y "25" eran tres destacamentos distintos en las licencias;
// · una tasa del dólar vieja seguía cobrando en PayPal;
// · la tasa había que escribirla a mano cada día; con la automática, un fallo
//   de la fuente no puede dejarla vacía ni cobrar para siempre con una vieja;
// · la clave secreta de PayPal no puede viajar en el documento que el
//   navegador lee.
// ----------------------------------------------------------------------
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  tasaVigente,
  cuentasListas,
  tasaConMargen,
  tasaTrasLectura,
  tasaDeFilasBcrd,
  tieneLicencia,
  construirPlanes,
  planesDisponibles,
  problemasDeConfiguracion,
  sanearConfiguracionMembresia,
} from '../../src/utils/membresia-onerrd.mjs';

const fabrica = sanearConfiguracionMembresia({});
const precios = (entrada, config = fabrica) =>
  planesDisponibles(entrada, config).map((p) => p.precio);

test('de fábrica: RD$2,500, RD$2,250 con fidelidad y RD$1,500 con licencia', () => {
  const p = construirPlanes(fabrica);
  assert.equal(p.nuevo.precio, 2500);
  assert.equal(p.fidelidad.precio, 2250);
  assert.equal(p.solo_registro.precio, 1500);
  assert.equal(fabrica.cobrosAbiertos, false);
});

test('cada plan suma sus piezas: cambiar el descuento cambia solo la fidelidad', () => {
  const p = construirPlanes(
    sanearConfiguracionMembresia({ descuentoFidelidad: 500, precioRriTrac: 1200 })
  );
  assert.equal(p.nuevo.precio, 2700);
  assert.equal(p.fidelidad.precio, 2200);
  assert.equal(p.solo_registro.precio, 1500);
  for (const plan of Object.values(p)) {
    assert.equal(plan.cuotaRegistro + plan.rriTrac - plan.descuento, plan.precio);
  }
});

test('qué planes le tocan a cada destacamento', () => {
  assert.deepEqual(precios({ registrado2026: false, licenciaVigente: false }), [2500]);
  assert.deepEqual(precios({ registrado2026: true, licenciaVigente: false }), [2250]);
  assert.deepEqual(precios({ registrado2026: true, licenciaVigente: true }), [1500, 2250]);
  assert.deepEqual(precios({ registrado2026: null, licenciaVigente: false }), []);
  assert.deepEqual(precios({ registrado2026: null, licenciaVigente: true }), [1500]);
});

test('un plan apagado no se ofrece', () => {
  const config = sanearConfiguracionMembresia({ planes: { solo_registro: { activo: false } } });
  assert.deepEqual(precios({ registrado2026: true, licenciaVigente: true }, config), [2250]);
});

test('las licencias se guardan por número sin ceros ni signos', () => {
  const config = sanearConfiguracionMembresia({ licencias: ['018', '#97', '179', '97', 'abc'] });
  assert.deepEqual(config.licencias, ['18', '97', '179']);
  assert.equal(tieneLicencia(config, '0097'), true);
  assert.equal(tieneLicencia(config, '25'), false);
});

test('la tasa vence a los días de vigencia', () => {
  const config = sanearConfiguracionMembresia({
    tasa: { rdPorUsd: 60.5, fecha: '2026-10-08', diasVigencia: 2 },
  });
  assert.equal(tasaVigente(config, new Date('2026-10-08T15:00:00Z')), 60.5);
  assert.equal(tasaVigente(config, new Date('2026-10-09T15:00:00Z')), 60.5);
  assert.equal(tasaVigente(config, new Date('2026-10-10T15:00:00Z')), null);
});

test('avisa de lo que impediría cobrar', () => {
  assert.ok(
    problemasDeConfiguracion(sanearConfiguracionMembresia({ cobrosAbiertos: true })).length
  );
  assert.ok(
    problemasDeConfiguracion(sanearConfiguracionMembresia({ descuentoFidelidad: 9999 })).length
  );
  assert.deepEqual(problemasDeConfiguracion(fabrica), []);
});

test('la clave secreta de PayPal no está en el documento que lee el navegador', () => {
  const config = sanearConfiguracionMembresia({
    paypal: { clientSecret: 'x'.repeat(40), secreto: 'y' },
  });
  assert.equal(JSON.stringify(config).includes('xxxx'), false);
  const reglas = readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8');
  assert.match(
    reglas,
    /match \/configuracionMembresia2027\/\{idDocumento\}[\s\S]*?idDocumento == 'general' && gestionaOnerrd\(\)/
  );
});

test('la landing lleva una copia exacta de estas reglas', () => {
  const landing = new URL(
    '../../../onerrd-membresia/src/utils/configuracion-membresia.mjs',
    import.meta.url
  );
  let copia;
  try {
    copia = readFileSync(landing, 'utf8');
  } catch {
    return; // La landing no está al lado (CI): no hay copia que comparar.
  }
  const original = readFileSync(
    new URL('../../src/utils/membresia-onerrd.mjs', import.meta.url),
    'utf8'
  );
  assert.equal(copia, original);
});

test('tasa automática: la lectura se guarda con el margen restado', () => {
  const tasa = sanearConfiguracionMembresia({ tasa: { automatica: true, margen: 3 } }).tasa;
  const ahora = new Date('2026-10-08T10:00:00Z');
  const nueva = tasaTrasLectura(tasa, { valor: 60.5, fuente: 'prueba' }, ahora);
  assert.equal(nueva.base, 60.5);
  assert.equal(nueva.rdPorUsd, tasaConMargen(60.5, 3));
  assert.ok(nueva.rdPorUsd < 60.5, 'el margen pide más dólares');
  assert.equal(nueva.fecha, '2026-10-08');
  assert.equal(nueva.fallosSeguidos, 0);
});

test('tasa automática: si falla sigue la anterior tres días y luego vence', () => {
  let tasa = sanearConfiguracionMembresia({
    tasa: { automatica: true, rdPorUsd: 58.7, base: 60.5, fecha: '2026-10-07' },
  }).tasa;
  for (let dia = 8; dia <= 10; dia += 1) {
    const ahora = new Date(`2026-10-${String(dia).padStart(2, '0')}T10:00:00Z`);
    tasa = tasaTrasLectura(tasa, { error: 'caída' }, ahora);
    assert.equal(tasa.rdPorUsd, 58.7);
    assert.equal(tasaVigente({ tasa }, ahora), 58.7, `día ${dia}: sigue cobrando`);
  }
  const cuarto = new Date('2026-10-11T10:00:00Z');
  tasa = tasaTrasLectura(tasa, { error: 'caída' }, cuarto);
  assert.equal(tasa.fallosSeguidos, 4);
  assert.equal(tasaVigente({ tasa }, cuarto), null, 'al cuarto día PayPal se apaga');
});

test('tasa automática: una lectura absurda cuenta como fallo; en manual no se toca', () => {
  const auto = sanearConfiguracionMembresia({ tasa: { automatica: true, rdPorUsd: 59 } }).tasa;
  assert.equal(tasaTrasLectura(auto, { valor: 0.017 }).rdPorUsd, 59);
  assert.equal(tasaTrasLectura(auto, { valor: 0.017 }).fallosSeguidos, 1);
  const manual = sanearConfiguracionMembresia({ tasa: { rdPorUsd: 59 } }).tasa;
  assert.deepEqual(tasaTrasLectura(manual, { valor: 61 }), manual);
});

test('BCRD: la tasa de compra de la última fila con datos de la hoja "Diaria"', () => {
  const filas = [
    ['Tasas de Cambio del dólar de Referencia del Mercado Spot'],
    [],
    ['Año', 'Mes', 'Día', 'Compra', 'Venta'],
    [2026, 'Oct', 6, 60.8522, 61.4111],
    [2026, 'Oct', 7, 61.0606, 61.6077],
    [null, null, null, null, null],
  ];
  assert.deepEqual(tasaDeFilasBcrd(filas), {
    compra: 61.0606,
    venta: 61.6077,
    fecha: '2026-10-07',
  });
  assert.equal(tasaDeFilasBcrd([['Año', 'Mes', 'Día', 'Compra', 'Venta']]), null);
});

test('cuentas: la cuenta única de antes (banco + rnc) se lee como la primera', () => {
  const vieja = sanearConfiguracionMembresia({
    banco: { nombre: 'Banreservas', titular: 'ONERRD', numeroCuenta: '123', rnc: '401' },
  });
  assert.deepEqual(vieja.cuentas, [
    {
      banco: 'Banreservas',
      titular: 'ONERRD',
      tipoCuenta: '',
      numeroCuenta: '123',
      documento: '401',
    },
  ]);
  const varias = sanearConfiguracionMembresia({
    banco: { nombre: 'Ignorada' },
    cuentas: [
      { banco: 'Banco BHD', titular: 'ONERRD', numeroCuenta: '9' },
      { banco: 'Banco Popular Dominicano' },
      {},
    ],
  });
  assert.equal(varias.cuentas.length, 2, 'la vacía se quita; manda la lista nueva');
  assert.equal(cuentasListas(varias).length, 1, 'sin titular ni número no se enseña');
});
