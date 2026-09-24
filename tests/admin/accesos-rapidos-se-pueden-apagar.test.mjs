import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { register } from 'node:module';
import assert from 'node:assert/strict';

// El codigo REAL, por el mismo alias con el que lo importa la aplicacion.
register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

// ----------------------------------------------------------------------
// LOS ACCESOS RAPIDOS DE LA PANTALLA PRINCIPAL SE RETIRARON.
//
// "Registrar actividad", "Proxima actividad", "Mis insignias" y "Capacitacion"
// eran atajos a sitios que tambien estan en el menu, y se podian apagar desde
// Ajustes. El 20/09/2026 (commit 8bdfaf66) se quitaron de la portada y el
// interruptor de Ajustes. Qué se rompía después: EXPLORA Designer seguía
// ofreciendo editar y publicar el bloque, sin que cambiara nada en pantalla. El
// bloque quedó `retirado`: se conserva (y se sanea) lo ya publicado, pero no se
// pinta ni sale en el Designer.
// ----------------------------------------------------------------------

const { defaultSettings } = await import('src/components/settings/settings-config.js');
const { bloquePorId, BLOQUES_DEL_DESIGNER } = await import('src/utils/everest/bloques.mjs');

const leer = (relativa) => fs.readFileSync(path.join(process.cwd(), relativa), 'utf8');

const VISTA = leer('src/sections/principal/view/principal-home-view.jsx');
const PANEL = leer('src/components/settings/drawer/settings-drawer.jsx');

test('la portada ya no pinta los accesos rapidos', () => {
  assert.doesNotMatch(VISTA, /<PrincipalAccesos/);
});

test('Ajustes ya no tiene el interruptor ni el valor guardado', () => {
  assert.equal('accesosRapidos' in defaultSettings, false);
  assert.doesNotMatch(PANEL, /Accesos rápidos/);
});

test('el bloque esta retirado: se conserva, pero el Designer no lo ofrece', () => {
  assert.equal(bloquePorId('accesos-rapidos')?.retirado, true);
  assert.ok(!BLOQUES_DEL_DESIGNER.some((bloque) => bloque.id === 'accesos-rapidos'));
});
