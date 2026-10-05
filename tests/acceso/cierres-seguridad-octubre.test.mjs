import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

test('Storage no confía en el perfil editable para privilegios ni identidad médica', () => {
  const rules = read('storage.rules');
  const global = rules.match(/function esAdministradorGlobal\(\) \{([\s\S]*?)\n    \}/)?.[1] || '';
  const ownMember = rules.match(/function esSuIdMiembro\(idMiembro\) \{([\s\S]*?)\n    \}/)?.[1] || '';
  const health = rules.match(/match \/documentos-salud-miembros\/\{idMiembro\}\/\{archivo\} \{([\s\S]*?)\n    \}/)?.[1] || '';

  assert.doesNotMatch(global, /documentoTieneRolAdministradorGlobal\('users'\)/);
  assert.doesNotMatch(ownMember, /tieneDocumento\('users'\)/);
  assert.match(health, /tienePermisoSalud\('salud\.ver'\)/);
  assert.match(health, /esSuIdMiembro\(idMiembro\)/);
});

test('el comodín de Firestore no reabre el gestor ni el calendario', () => {
  const rules = read('firestore.rules');
  assert.match(rules, /match \/gestorArchivos\/\{idArchivo\}/);
  assert.match(rules, /match \/actividades_calendario\/\{idActividad\}/);
  assert.match(rules, /coleccion != 'gestorArchivos'/);
  assert.match(rules, /coleccion != 'roles'/);
  assert.match(rules, /coleccion != 'permisos'/);
  assert.match(rules, /coleccion != 'actividades_calendario'/);
  assert.match(rules, /coleccion != 'contadores_comercio'/);
  assert.match(rules, /request\.resource\.data\.ultimo == resource\.data\.ultimo \+ 1/);
});

test('las escrituras efectivas de organización requieren aprobación en servidor', () => {
  for (const path of [
    'src/app/api/regional/put/route.js',
    'src/app/api/sectional/post/route.js',
    'src/app/api/sectional/put/route.js',
    'src/app/api/dest/post/route.js',
    'src/app/api/dest/put/route.js',
  ]) {
    const source = read(path);
    assert.match(source, /exigirPermisoDeCargoRest\(req, \['organizacion\.aprobar_cambios'\]\)/, path);
  }
});

test('el proxy de imágenes requiere sesión, host permitido y no sigue redirecciones', () => {
  const source = read('src/app/api/image-data-url/route.js');
  assert.match(source, /exigirSesionRest\(req\)/);
  assert.match(source, /ALLOWED_IMAGE_HOSTS\.has/);
  assert.match(source, /redirect: 'error'/);
});

test('calendario y sembrado de notificaciones usan identidad REST', () => {
  const calendar = read('src/app/api/calendar/route.js');
  const actions = read('src/actions/calendar.js');
  const seed = read('src/app/api/notifications/seed/route.js');
  assert.match(calendar, /createChatFirestoreRestClient/);
  assert.match(calendar, /exigirPermisoDeCargoRest/);
  assert.match(actions, /headers: await authHeaders/);
  assert.match(seed, /exigirAdministradorGlobalRest/);
  assert.match(seed, /client\.commitWrites/);
});
