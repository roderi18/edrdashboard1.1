import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { register } from 'node:module';
import assert from 'node:assert/strict';

// El codigo REAL, por el mismo alias con el que lo importa la aplicacion.
register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

// ----------------------------------------------------------------------
// LOS CUATRO ACCESOS RAPIDOS DE LA PANTALLA PRINCIPAL SE PUEDEN APAGAR.
//
// "Registrar actividad", "Proxima actividad", "Mis insignias" y "Capacitacion"
// son atajos a sitios que tambien estan en el menu. Quien no los use los quita
// desde el panel de ajustes, debajo de "Barra y cabecera".
//
// LO QUE SE ROMPIA: un ajuste nuevo no esta en los ajustes YA GUARDADOS de cada
// navegador. Si la pantalla preguntara por el valor a secas, a todo el mundo le
// desaparecerian los accesos al actualizar, porque ahi la clave llega
// `undefined`. Se pregunta por `!== false`: solo los apaga quien los apago.
// ----------------------------------------------------------------------

const { defaultSettings } = await import('src/components/settings/settings-config.js');

const leer = (relativa) => fs.readFileSync(path.join(process.cwd(), relativa), 'utf8');

const VISTA = leer('src/sections/principal/view/principal-home-view.jsx');
const PANEL = leer('src/components/settings/drawer/settings-drawer.jsx');

test('vienen encendidos', () => {
  assert.equal(defaultSettings.accesosRapidos, true);
});

// La regla, ejecutada tal cual la escribe la pantalla.
const accesosVisibles = (ajustes) => ajustes.accesosRapidos !== false;

test('solo se apagan si alguien los apago', () => {
  assert.equal(accesosVisibles({ accesosRapidos: false }), false);
  assert.equal(accesosVisibles({ accesosRapidos: true }), true);
  // Ajustes guardados antes de que existiera la clave.
  assert.equal(accesosVisibles({}), true);
});

test('la pantalla Principal los esconde con esa misma regla', () => {
  assert.match(VISTA, /settings\.state\.accesosRapidos !== false/);
  assert.match(VISTA, /\{accesosVisibles && <PrincipalAccesos accesos=\{ACCESOS_RAPIDOS\} \/>\}/);
});

test('el interruptor esta en el panel de ajustes, debajo de "Barra y cabecera"', () => {
  assert.match(PANEL, /title="Accesos rápidos"/);
  assert.match(PANEL, /settings\.setState\(\{ accesosRapidos: !accesosVisibles \}\)/);

  const orden = PANEL.indexOf('{visibility.navBlanco && renderNavBlanco()}');
  const despues = PANEL.indexOf('{visibility.accesosRapidos && renderAccesosRapidos()}');

  assert.ok(orden > 0 && despues > orden);
});
