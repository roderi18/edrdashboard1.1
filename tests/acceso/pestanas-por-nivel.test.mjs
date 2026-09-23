import fs from 'node:fs';
import test from 'node:test';
import path from 'node:path';
import assert from 'node:assert/strict';

// CADA NIVEL ENSEÑA LO QUE CUELGA DE EL.
//
// Los miembros estan dichos en su destacamento, los destacamentos en su seccion y
// las secciones en su region. Las tres pestañas reutilizan la MISMA lista de cada
// entidad: una tabla nueva escrita a mano se separaria de la original a la
// primera correccion.
//
// La visibilidad NO cambia: la pestaña acota lo que el alcance ya deja ver, no lo
// abre.

const leer = (relativa) => fs.readFileSync(path.join(process.cwd(), relativa), 'utf8');

test('la seccion tiene pestaña de destacamentos y la region de secciones', () => {
  const seccion = leer('src/sections/sectional/layout/sectional-edit-layout.jsx');
  const region = leer('src/sections/regional/layout/regional-edit-layout.jsx');

  assert.match(seccion, /label: 'Destacamentos',/);
  assert.match(seccion, /edit\/dests`/);
  assert.match(region, /label: 'Secciones',/);
  assert.match(region, /edit\/sections`/);
});

test('las paginas existen y reutilizan la lista de siempre', () => {
  const paginaDests = leer('src/app/dashboard/level/sectional/[id]/edit/dests/page.jsx');
  const paginaSecciones = leer('src/app/dashboard/level/regional/[id]/edit/sections/page.jsx');
  const vistaDests = leer('src/sections/sectional/dests/sectional-dests-view.jsx');
  const vistaSecciones = leer('src/sections/regional/sections/regional-sections-view.jsx');

  // La pagina solo monta la vista: el encabezado ya no se lo pasa a mano con
  // `tituloPrefijo`, lo pone la cabecera comun a partir de la pestaña activa.
  assert.match(paginaDests, /<SectionalDestsView \/>/);
  assert.match(paginaSecciones, /<RegionalSectionsView \/>/);
  assert.match(vistaDests, /<DestListView sectionalId=\{sectionalId\} \/>/);
  assert.match(vistaSecciones, /<SectionalListView regionalId=\{regionalId\} \/>/);
});

test('el nombre de la pestaña abierta lo pone la cabecera comun', () => {
  const cabecera = leer('src/sections/common/organizational-profile-navigation.jsx');

  // Donde vivia `tituloPrefijo`: la miga final es la etiqueta de la pestaña
  // activa, asi que ningun nivel puede volver a escribirla por su cuenta.
  assert.match(cabecera, /tabs\.find\(\(tab\) => tab\.href === value\)/);
  assert.match(cabecera, /\{ name: tabActual\.label \}/);
});

test('la pestaña acota lo que el alcance ya deja ver, no lo abre', () => {
  const listaDests = leer('src/sections/dest/view/dest-list-view.jsx');
  const listaSecciones = leer('src/sections/sectional/view/sectional-list-view.jsx');

  // Se filtra `tableData`, que es lo que ya paso por el filtro de alcance.
  assert.match(
    listaDests,
    /esPestanaDeSeccion\s*\n?\s*\? tableData\.filter\(\(row\) => String\(row\?\.sectionalId \?\? ''\) === String\(sectionalId\)\)/
  );
  assert.match(
    listaSecciones,
    /esPestanaDeRegion\s*\n?\s*\? tableData\.filter\(\(row\) => String\(row\?\.regionalId \?\? ''\) === String\(regionalId\)\)/
  );

  // Y el filtro de alcance sigue donde estaba.
  assert.match(listaDests, /filterDestsByMemberScope/);
});

test('dentro de la ficha no se repite la cabecera', () => {
  const listaDests = leer('src/sections/dest/view/dest-list-view.jsx');
  const listaSecciones = leer('src/sections/sectional/view/sectional-list-view.jsx');

  assert.match(listaDests, /if \(esPestanaDeSeccion\) \{/);
  assert.match(listaSecciones, /if \(esPestanaDeRegion\) \{/);
});
