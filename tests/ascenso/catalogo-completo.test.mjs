import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

// EL CATALOGO ALIMENTA DOS PANTALLAS A LA VEZ.
//
// El arbol de `_awards` es lo que se navega en la ficha del miembro Y lo que
// ofrece el selector de rutas de los certificados automaticos. Un premio que no
// aparezca aqui no se puede completar ni se le puede enganchar un certificado,
// asi que estas pruebas fijan lo que no puede romperse al tocar el catalogo.

const { _awards } = await import('src/_mock/_awards.js');
const { construirNodosAscenso, idDeRutaAscenso } = await import(
  'src/catalogs/sistema-ascenso.js'
);

const RAIZ = 'sistema-de-ascenso';
const porId = new Map(_awards.map((n) => [n.id, n]));
const hijos = (pid) => _awards.filter((n) => n.parentId === pid);
const hojas = (pid) => hijos(pid).flatMap((n) => (n.type === 'folder' ? hojas(n.id) : [n]));

test('ningun id se repite: es la llave con la que se guarda el progreso', () => {
  const ids = _awards.map((n) => n.id);

  assert.equal(new Set(ids).size, ids.length);
});

test('ningun nodo cuelga de un padre que no existe', () => {
  const huerfanos = _awards.filter((n) => n.parentId && !porId.has(n.parentId));

  assert.deepEqual(huerfanos.map((n) => n.id), []);
});

test('las tres divisiones traen los premios del inventario', () => {
  const cuenta = (division) => hojas(idDeRutaAscenso(division)).length;

  // 223 + 141 + 122. Del inventario se caen los "(1)" —copias del mismo
  // archivo— y los dos Orden.png, que no son premios.
  assert.equal(cuenta('Exploradores'), 223);
  assert.equal(cuenta('Seguidores'), 141);
  assert.equal(cuenta('Pioneros'), 122);
});

test('Navegantes y la Academia siguen ahi: no vienen del inventario', () => {
  assert.equal(hojas('navegantes').length, 20);
  assert.equal(hojas('academia-ministerial').length, 11);
});

test('el mismo premio en dos divisiones son dos premios distintos', () => {
  const enTres = ['Exploradores', 'Seguidores', 'Pioneros'].map((division) =>
    _awards.find(
      (n) => n.name === 'Lectura de la Biblia' && n.id.startsWith(idDeRutaAscenso(division))
    )
  );

  assert.equal(enTres.filter(Boolean).length, 3);
  assert.equal(new Set(enTres.map((n) => n.id)).size, 3);
});

test('cada premio tiene ruta para el selector de certificados', () => {
  const camino = (nodo) => {
    const ruta = [];
    let actual = nodo;

    while (actual) {
      ruta.unshift(actual);
      actual = porId.get(actual.parentId);
    }

    return ruta;
  };

  const premios = _awards.filter((n) => n.type !== 'folder');
  const seleccionables = premios.filter((premio) => {
    const ruta = camino(premio);
    const indiceRaiz = ruta.findIndex((n) => n.id === RAIZ);
    const division = indiceRaiz >= 0 ? ruta[indiceRaiz + 1] : null;
    const esAscenso = ruta[0]?.id === RAIZ;

    return Boolean(premio.parentId) && (!esAscenso || Boolean(division?.id));
  });

  assert.equal(seleccionables.length, premios.length);
});

test('las guias semanales llegan a cinco tramos de profundidad', () => {
  const guia = _awards.find(
    (n) => n.id === idDeRutaAscenso('Seguidores', 'Guías Semanales', 'Senda de Bronce', 'Trimestre 1', 'SS-A1T1S1')
  );

  assert.ok(guia, 'no se encontro SS-A1T1S1');
  assert.equal(guia.type, 'pdf');
});

test('el catalogo y el arbol publicado dicen lo mismo', () => {
  const construidos = construirNodosAscenso();

  // Todo lo que sale del catalogo esta publicado en `_awards`, y con el mismo
  // nombre: si alguien edita el arbol a mano, esta prueba lo caza.
  construidos.forEach((nodo) => {
    const publicado = porId.get(nodo.id);

    assert.ok(publicado, `falta en _awards: ${nodo.id}`);
    assert.equal(publicado.name, nodo.name);
    assert.equal(publicado.parentId, nodo.parentId);
  });
});
