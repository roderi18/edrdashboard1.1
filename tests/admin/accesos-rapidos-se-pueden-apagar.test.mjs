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
// Un ajuste nuevo no esta en los ajustes YA GUARDADOS de cada navegador. La
// ausencia de la clave también debe significar "apagado": solo aparecen cuando
// el usuario los activa de forma expresa.
// ----------------------------------------------------------------------

const { defaultSettings } = await import('src/components/settings/settings-config.js');

const leer = (relativa) => fs.readFileSync(path.join(process.cwd(), relativa), 'utf8');

const VISTA = leer('src/sections/principal/view/principal-home-view.jsx');
const PANEL = leer('src/components/settings/drawer/settings-drawer.jsx');

test('vienen apagados', () => {
  assert.equal(defaultSettings.accesosRapidos, false);
});

// La regla, ejecutada tal cual la escribe la pantalla.
const accesosVisibles = (ajustes) => ajustes.accesosRapidos === true;

test('solo se muestran si alguien los activo', () => {
  assert.equal(accesosVisibles({ accesosRapidos: false }), false);
  assert.equal(accesosVisibles({ accesosRapidos: true }), true);
  // Ajustes guardados antes de que existiera la clave.
  assert.equal(accesosVisibles({}), false);
});

test('la pantalla Principal los esconde con esa misma regla', () => {
  assert.match(VISTA, /settings\.state\.accesosRapidos === true/);
  // Los accesos llegan del lector de la portada desde EXPLORA Designer (fase 2);
  // el interruptor sigue decidiendo si salen o no.
  assert.match(
    VISTA,
    /\{accesosVisibles && \(\s*<PrincipalAccesos\s+accesos=\{portada\['accesos-rapidos'\]\.contenido\}/
  );
});

test('el interruptor esta en el panel de ajustes, debajo de "Barra y cabecera"', () => {
  assert.match(PANEL, /title="Accesos rápidos"/);
  assert.match(PANEL, /settings\.setState\(\{ accesosRapidos: !accesosVisibles \}\)/);

  const orden = PANEL.indexOf('{visibility.navBlanco && renderNavBlanco()}');
  const despues = PANEL.indexOf('{visibility.accesosRapidos && renderAccesosRapidos()}');

  assert.ok(orden > 0 && despues > orden);
});
