// ----------------------------------------------------------------------
// EL ADMINISTRADOR GLOBAL ELIMINA CARPETAS DEL SISTEMA DE ASCENSO.
//
// Que se rompia: "Eliminar" solo existia en la vista de cuadricula; en la de
// lista el menu de una carpeta no lo tenia. La confirmacion decia "¿Eliminar
// este elemento?" sin avisar de que la carpeta se lleva todo lo de dentro, y
// nada impedia intentar eliminar un programa de la raiz (con el se iria el
// arbol entero de todos los miembros).
//
// Eliminar OCULTA para todos (`configuracion_premios/eliminados`, solo el
// Administrador Global por `firestore.rules`): el progreso y los certificados
// de los miembros no se borran.
// ----------------------------------------------------------------------

import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { readFile } from 'node:fs/promises';

register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

const { quitarEliminados, contenidoDeCarpeta, motivoParaNoEliminar, avisoDeEliminarCarpeta } =
  await import('../../src/utils/premios-personalizados.mjs');

const leer = (ruta) => readFile(new URL(`../../${ruta}`, import.meta.url), 'utf8');

// sistema-de-ascenso → exploradores → guias → (fogata, nudos) y especialidades → (primeros-auxilios)
const ARBOL = [
  { id: 'sistema-de-ascenso', parentId: null, type: 'folder', name: 'Sistema de Ascenso' },
  { id: 'exploradores', parentId: 'sistema-de-ascenso', type: 'folder', name: 'Exploradores' },
  { id: 'guias', parentId: 'exploradores', type: 'folder', name: 'Guías' },
  { id: 'fogata', parentId: 'guias', type: 'pdf', name: 'Fogata' },
  { id: 'nudos', parentId: 'guias', type: 'pdf', name: 'Nudos' },
  { id: 'especialidades', parentId: 'guias', type: 'folder', name: 'Especialidades' },
  { id: 'primeros-auxilios', parentId: 'especialidades', type: 'pdf', name: 'Primeros auxilios' },
  { id: 'otra', parentId: 'exploradores', type: 'pdf', name: 'Otra' },
];

test('los programas de la raiz no se eliminan; cualquier otra carpeta, si', () => {
  assert.match(motivoParaNoEliminar(ARBOL[0]), /raíz/);
  assert.equal(motivoParaNoEliminar(ARBOL[1]), '');
  assert.equal(motivoParaNoEliminar(ARBOL[2]), '');
  assert.match(motivoParaNoEliminar(undefined), /No se encontró/);
});

test('cuenta todo lo que se oculta con la carpeta, a cualquier profundidad', () => {
  assert.deepEqual(contenidoDeCarpeta(ARBOL, 'guias'), { carpetas: 1, premios: 3 });
  assert.deepEqual(contenidoDeCarpeta(ARBOL, 'especialidades'), { carpetas: 0, premios: 1 });
  assert.deepEqual(contenidoDeCarpeta(ARBOL, 'fogata'), { carpetas: 0, premios: 0 });
});

test('un ciclo en el arbol no cuelga el conteo', () => {
  const conCiclo = [
    { id: 'a', parentId: 'b', type: 'folder' },
    { id: 'b', parentId: 'a', type: 'folder' },
  ];

  assert.deepEqual(contenidoDeCarpeta(conCiclo, 'a'), { carpetas: 1, premios: 0 });
});

test('el aviso dice que se va y que el progreso se queda', () => {
  const aviso = avisoDeEliminarCarpeta(ARBOL, ARBOL[2]);

  assert.match(aviso, /"Guías"/);
  assert.match(aviso, /1 subcarpeta y 3 premios/);
  assert.match(aviso, /no se borran/);
  assert.doesNotMatch(avisoDeEliminarCarpeta(ARBOL, { id: 'vacia', name: 'Vacía' }), /contiene/);
});

test('lo que cuelga de una carpeta eliminada deja de pintarse', () => {
  const quedan = quitarEliminados(ARBOL, { guias: true }).map((n) => n.id);

  assert.deepEqual(quedan, ['sistema-de-ascenso', 'exploradores', 'otra']);
});

test('la vista de lista ofrece "Eliminar carpeta", con el mismo poder que renombrar', async () => {
  const fila = await leer('src/sections/member/awards/awards-manager-table-row.jsx');

  assert.match(
    fila,
    /row\.type === 'folder' && Boolean\(onRenombrar\) && !motivoParaNoEliminar\(row\)/
  );
  assert.match(fila, /Eliminar carpeta/);
  assert.match(fila, /avisoDeEliminarCarpeta\(/);
});

test('la cuadricula avisa del contenido y no ofrece eliminar la raiz', async () => {
  const tarjeta = await leer('src/sections/member/awards/awards-manager-folder-item.jsx');

  assert.match(tarjeta, /onRenombrar && !motivoParaNoEliminar\(folder\)/);
  assert.match(tarjeta, /avisoDeEliminarCarpeta\(folder\.allData/);
  assert.doesNotMatch(tarjeta, /¿Seguro que deseas eliminar este elemento\?/);
});

test('eliminar exige Administrador Global y salta la raiz aunque venga seleccionada', async () => {
  const [vista, servicio, reglas] = await Promise.all([
    leer('src/sections/member/awards/view/awards-manager-view.jsx'),
    leer('src/services/premios-personalizados-service.js'),
    leer('firestore.rules'),
  ]);

  assert.match(vista, /const puedeMover = isAdminGlobal\(user\)/);
  assert.match(vista, /onRenombrar=\{puedeMover \? abrirRenombrar : undefined\}/);
  assert.match(vista, /idsPedidos\.includes\(n\.id\) && !motivoParaNoEliminar\(n\)/);
  assert.match(servicio, /if \(!isAdminGlobal\(usuario\)\) throw new Error\('Solo el Administrador Global elimina premios\.'\)/);
  assert.match(
    reglas,
    /match \/configuracion_premios\/\{idDocumento\} \{\s*allow read: if esUsuarioDelSistema\(\);\s*allow write: if esAdministradorGlobal\(\);/
  );
});
