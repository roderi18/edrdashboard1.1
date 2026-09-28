import fs from 'node:fs';
import test from 'node:test';
import path from 'node:path';
import assert from 'node:assert/strict';
import { register } from 'node:module';

// El codigo REAL, por el mismo alias con el que lo importa la aplicacion.
register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

// ----------------------------------------------------------------------
// LA CUENTA ATRÁS DE LA PÁGINA DE REGISTRO SE ELIGE DESDE EL DASHBOARD.
//
// Antes la fecha de cierre estaba escrita en el código de la landing y cambiarla
// exigía publicar. Ahora la eligen el Administrador Global y la Oficina Nacional
// en la bandeja de actualizaciones. Lo que no puede romperse: la hora es la de
// Santo Domingo (no la del navegador de quien la elige), lo roto vuelve a la de
// fábrica en vez de dejar la landing sin cuenta, y la colección está cerrada en
// las reglas.
// ----------------------------------------------------------------------

const leer = (relativa) => fs.readFileSync(path.join(process.cwd(), relativa), 'utf8');

const {
  aIsoSantoDomingo,
  partesDeLoQueFalta,
  normalizarCuentaRegresiva,
  cambiosDeCuentaRegresiva,
  CUENTA_REGRESIVA_DE_FABRICA,
} = await import('../../src/utils/cuenta-regresiva-landing.mjs');

test('el cierre se guarda en hora de Santo Domingo, sea cual sea la zona de quien lo elige', () => {
  assert.equal(aIsoSantoDomingo('2026-10-13T03:59:59Z'), '2026-10-12T23:59:59-04:00');
  assert.equal(aIsoSantoDomingo(new Date('2026-10-12T23:59:59-04:00')), '2026-10-12T23:59:59-04:00');
});

test('lo roto o ausente vuelve a la cuenta de fábrica', () => {
  assert.deepEqual(normalizarCuentaRegresiva({}), { ...CUENTA_REGRESIVA_DE_FABRICA });
  assert.equal(normalizarCuentaRegresiva({ cierre: 'no es fecha' }).cierre, CUENTA_REGRESIVA_DE_FABRICA.cierre);
  assert.equal(normalizarCuentaRegresiva({ texto: '   ' }).texto, CUENTA_REGRESIVA_DE_FABRICA.texto);
  assert.equal(normalizarCuentaRegresiva({ mostrar: false }).mostrar, false);
});

test('días, horas, minutos y segundos, sin negativos al pasar el cierre', () => {
  const unDiaDosHoras = ((24 + 2) * 3600 + 3 * 60 + 4) * 1000;
  assert.deepEqual(partesDeLoQueFalta(unDiaDosHoras), { dias: 1, horas: 2, minutos: 3, segundos: 4 });
  assert.deepEqual(partesDeLoQueFalta(-5000), { dias: 0, horas: 0, minutos: 0, segundos: 0 });
});

test('Historial recibe solo lo que cambia', () => {
  const cambios = cambiosDeCuentaRegresiva(
    { cierre: '2026-10-12T23:59:59-04:00' },
    { cierre: '2026-10-19T23:59:59-04:00' }
  );
  assert.deepEqual(cambios.map((c) => c.campo), ['cierre']);
});

test('la configuración está cerrada en las reglas de Firestore', () => {
  assert.match(
    leer('firestore.rules'),
    /match \/configuracion_landing_registro\/\{idConfiguracion\} \{\s*allow read, write: if esAdministradorGlobal\(\)/
  );
});

test('la landing lee el mismo documento', () => {
  const landing = path.join(process.cwd(), '..', 'errd-registro', 'src', 'server', 'cuenta-regresiva.mjs');
  if (!fs.existsSync(landing)) return; // la landing es otro proyecto: puede no estar al lado
  const fuente = fs.readFileSync(landing, 'utf8');
  assert.match(fuente, /configuracion_landing_registro/);
  assert.match(fuente, /cuenta_regresiva/);
});
