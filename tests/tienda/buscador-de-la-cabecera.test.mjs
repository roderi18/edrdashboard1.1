import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { register } from 'node:module';
import assert from 'node:assert/strict';

// El codigo REAL, por el mismo alias con el que lo importa la aplicacion.
register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

// ----------------------------------------------------------------------
// EL BUSCADOR DE LA CABECERA ENCUENTRA LA TIENDA Y LOS PREMIOS.
//
// Decia "Buscar actividades, personas, insignias, documentos..." y solo miraba
// los nombres de las PANTALLAS del menu: escribir "emblema" o "1 Cronicas" no
// devolvia nada.
//
// Y las caras tenian que salir con el texto, no despues: la foto de un producto
// pesa entre 16 y 250 kB, asi que en el buscador va una miniatura de ~2 kB que
// viaja DENTRO del catalogo, y los premios —que no tienen imagen en ningun
// sitio— llevan el icono de su grupo o de su division.
// ----------------------------------------------------------------------

const { iconoDePremio, buscarEnCatalogo, normalizarTexto } = await import(
  'src/utils/buscador-catalogo.mjs'
);

const leer = (relativa) => fs.readFileSync(path.join(process.cwd(), relativa), 'utf8');

const CATALOGO = [
  { id: '1', nombre: 'Emblema grande', codigo: 'ERRD-001', categoria: 'insignias-emblemas' },
  { id: '2', nombre: 'Distintivo con emblema', codigo: 'ERRD-005', categoria: 'parches' },
  { id: '3', nombre: '1 Crónicas', grupo: 'Premios Bíblicos - Naranja', division: 'Pioneros' },
  { id: '4', nombre: 'Correa nylon negra', codigo: 'ERRD-022', categoria: 'accesorios' },
];

test('encuentra por nombre, por código y por categoría', () => {
  assert.deepEqual(
    buscarEnCatalogo({ catalogo: CATALOGO, consulta: 'emblema' }).map((item) => item.id),
    ['1', '2']
  );
  assert.deepEqual(
    buscarEnCatalogo({ catalogo: CATALOGO, consulta: 'ERRD-022' }).map((item) => item.id),
    ['4']
  );
  assert.deepEqual(
    buscarEnCatalogo({ catalogo: CATALOGO, consulta: 'accesorios' }).map((item) => item.id),
    ['4']
  );
});

// En un teclado de telefono la tilde se pone sola o no se pone.
test('las tildes no esconden un resultado', () => {
  assert.equal(normalizarTexto('1 Crónicas'), '1 cronicas');
  assert.deepEqual(
    buscarEnCatalogo({ catalogo: CATALOGO, consulta: 'cronicas' }).map((item) => item.id),
    ['3']
  );
  assert.deepEqual(
    buscarEnCatalogo({ catalogo: CATALOGO, consulta: 'Crónicas' }).map((item) => item.id),
    ['3']
  );
});

test('lo que EMPIEZA por lo escrito va primero', () => {
  const [primero] = buscarEnCatalogo({ catalogo: CATALOGO, consulta: 'emb' });

  assert.equal(primero.nombre, 'Emblema grande');
});

test('sin texto no se enseña nada, y la lista tiene tope', () => {
  assert.deepEqual(buscarEnCatalogo({ catalogo: CATALOGO, consulta: '' }), []);
  assert.deepEqual(buscarEnCatalogo({ catalogo: CATALOGO, consulta: '   ' }), []);
  assert.equal(buscarEnCatalogo({ catalogo: CATALOGO, consulta: 'e', tope: 2 }).length, 2);
});

// Los premios no guardan imagen: `itemsAscenso` solo tiene nombre, grupo,
// division y ruta. Se les pone el icono que ya usa la pantalla de ascenso.
test('cada premio sale con el icono de su grupo o el de su división', () => {
  assert.equal(iconoDePremio({ idGrupo: 'fundamentos' }), '/icons/fundamentos.png');
  assert.equal(iconoDePremio({ idDivision: 'pioneros' }), '/icons/pioneros.png');
  // Los grupos del sistema de ascenso llevan la division delante.
  assert.equal(
    iconoDePremio({ idGrupo: 'seguidores__premios-biblicos-cafe' }),
    '/icons/seguidores.png'
  );
  assert.equal(iconoDePremio({}), '/icons/exploradores-del-rey.png');
});

test('la miniatura viaja dentro del catálogo: la foto de verdad no', () => {
  const api = leer('src/app/api/buscador/route.js');

  assert.match(api, /miniatura: textoLimpio\(ficha\.miniatura\)/);
  assert.doesNotMatch(api, /imagenPortada/);
  assert.match(leer('src/utils/image-optimizer.js'), /miniaturaBuscador: \{\s*maxWidth: 64/);
});

test('editar un producto sin cambiar la foto no lo deja sin cara', () => {
  const indice = leer('src/services/buscador-indice-service.js');

  assert.match(indice, /miniatura === undefined \? \{\} : \{ miniatura/);
});

test('el buscador pide el catálogo solo cuando se abre', () => {
  const buscador = leer('src/layouts/components/searchbar/index.jsx');

  assert.match(buscador, /useCatalogoDelBuscador\(buscadorAbierto\)/);
  assert.match(buscador, /const buscadorAbierto = open \|\| enfocado \|\| Boolean\(searchQuery\)/);
});

test('el índice del buscador tiene su propia regla y no cae en el comodín', () => {
  const reglas = leer('firestore.rules');

  assert.match(reglas, /match \/indice_buscador\/\{documento\}/);
  assert.match(reglas, /coleccion != 'indice_buscador'/);
});
