import test from 'node:test';
import { register } from 'node:module';
import assert from 'node:assert/strict';

// El codigo REAL, por el mismo alias con el que lo importa la aplicacion.
register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

// ----------------------------------------------------------------------
// EL ACENTO DE LA CASA ES EL AZUL CIELO.
//
// El selector del engranaje enseña los presets en el ORDEN de esta tabla, y el
// primero —`default`— es el que trae la aplicacion puesta. Estaba el azul
// institucional y el cielo iba segundo, de adorno: se intercambiaron porque el
// cielo es el que se lee sobre el navy de la barra y la cabecera, que es donde
// vive el acento.
//
// Si alguien vuelve a mover la tabla, esto se cae: el orden no es decorativo,
// decide con que color entra todo el mundo.
// ----------------------------------------------------------------------

const { primaryColorPresets, secondaryColorPresets } = await import(
  'src/theme/with-settings/color-presets.js'
);
const { defaultSettings } = await import('src/components/settings/settings-config.js');
const { primary } = await import('src/theme/core/palette.js');

test('la aplicación entra con el preset de por defecto', () => {
  assert.equal(defaultSettings.primaryColor, 'default');
});

test('el de por defecto es el azul cielo, y va primero en el selector', () => {
  assert.equal(primaryColorPresets.default.main, '#1C74D4');
  assert.equal(Object.keys(primaryColorPresets)[0], 'default');
});

test('el azul institucional no se pierde: queda en el segundo puesto', () => {
  assert.equal(primaryColorPresets.preset1.main, primary.main);
  assert.equal(Object.keys(primaryColorPresets)[1], 'preset1');
});

// El secundario viaja con su primario: al intercambiarlos habia que
// intercambiar tambien sus parejas, o el acento nuevo salia con el compañero del
// anterior.
test('cada preset conserva su pareja de secundario', () => {
  assert.equal(secondaryColorPresets.default.main, '#C9A227');
  assert.deepEqual(Object.keys(primaryColorPresets), Object.keys(secondaryColorPresets));
});
