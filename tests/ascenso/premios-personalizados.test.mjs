import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

// PREMIOS AÑADIDOS DESDE LA APLICACIÓN.
//
// El Administrador Global añade un premio (nombre + imagen) a una carpeta final
// y sale para todos detrás de los del catálogo. Uno roto (sin imagen, sin
// carpeta, id ajeno) no debe entrar en el árbol: pintaría una tarjeta vacía.

const { premioDesdeDocumento, unirPremios, validarPremioNuevo, idDePremioNuevo } = await import(
  '../../src/utils/premios-personalizados.mjs'
);

const bueno = {
  id: 'pp1790000000000',
  nombre: 'Nuevo premio',
  idCarpeta: 'lider-juvenil',
  imagenUrl: 'https://firebasestorage.googleapis.com/x.webp',
};

test('un documento bueno se vuelve premio de la carpeta', () => {
  const premio = premioDesdeDocumento(bueno);
  assert.equal(premio.parentId, 'lider-juvenil');
  assert.equal(premio.type, 'pdf');
  assert.equal(premio.imagenUrl, bueno.imagenUrl);
});

test('uno roto o desactivado no entra', () => {
  assert.equal(premioDesdeDocumento({ ...bueno, id: 'ajedrez' }), null);
  assert.equal(premioDesdeDocumento({ ...bueno, activo: false }), null);
});

test('se suman detrás del catálogo sin repetir', () => {
  const catalogo = [{ id: 'a' }, { id: 'b' }];
  const unidos = unirPremios(catalogo, [premioDesdeDocumento(bueno), { id: 'a' }]);
  assert.deepEqual(unidos.map((n) => n.id), ['a', 'b', 'pp1790000000000']);
});

test('pide nombre, carpeta e imagen', () => {
  assert.ok(validarPremioNuevo({ nombre: '', idCarpeta: 'x', tieneImagen: true }));
  // La imagen es opcional.
  assert.equal(validarPremioNuevo({ nombre: 'Premio', idCarpeta: 'x', tieneImagen: false }), '');
  assert.equal(premioDesdeDocumento({ ...bueno, imagenUrl: '' }).imagenUrl, undefined);
  assert.equal(validarPremioNuevo({ nombre: 'Premio', idCarpeta: 'x', tieneImagen: true }), '');
  assert.match(idDePremioNuevo(5), /^pp5$/);
});

test('una carpeta añadida entra como carpeta del árbol', () => {
  const carpeta = premioDesdeDocumento({ ...bueno, tipo: 'carpeta' });
  assert.equal(carpeta.type, 'folder');
  assert.ok(validarPremioNuevo({ nombre: 'X', idCarpeta: 'y', tieneImagen: true, tipo: 'otro' }));
});

const { aplicarUbicaciones, motivoParaNoMover } = await import(
  '../../src/utils/premios-personalizados.mjs'
);

test('mover cambia la carpeta y recuerda la de origen', () => {
  const arbol = [
    { id: 'raiz', parentId: null, type: 'folder' },
    { id: 'a', parentId: 'raiz', type: 'folder' },
    { id: 'b', parentId: 'raiz', type: 'folder' },
    { id: 'premio', parentId: 'a', type: 'pdf' },
  ];
  const movido = aplicarUbicaciones(arbol, { premio: 'b' }).find((n) => n.id === 'premio');
  assert.equal(movido.parentId, 'b');
  assert.equal(movido.parentIdOriginal, 'a');
  assert.equal(motivoParaNoMover(arbol, 'premio', 'b'), '');
  assert.ok(motivoParaNoMover(arbol, 'a', 'a'));
});

const { origenDelProgreso } = await import('../../src/utils/premios-personalizados.mjs');

test('el progreso de un premio movido se sigue leyendo en su origen', () => {
  const base = [
    { id: 'sistema-de-ascenso', parentId: null, type: 'folder' },
    { id: 'pioneros', parentId: 'sistema-de-ascenso', type: 'folder' },
    { id: 'azul', parentId: 'pioneros', type: 'folder' },
    { id: 'ajedrez', parentId: 'azul', type: 'pdf' },
  ];
  const origen = origenDelProgreso(base, { id: 'ajedrez', parentId: 'otra', parentIdOriginal: 'azul' });
  assert.deepEqual(origen, { carpeta: 'azul', sistema: 'sistema-de-ascenso', division: 'pioneros' });
});

const { aplicarNombres, motivoParaNoRenombrar } = await import(
  '../../src/utils/premios-personalizados.mjs'
);

test('renombrar cambia el nombre y guarda el original para la imagen', () => {
  const [raiz, premio] = aplicarNombres(
    [
      { id: 'sistema-de-ascenso', parentId: null, name: 'Sistema de Ascenso' },
      { id: 'ajedrez', parentId: 'azul', name: 'Ajedrez' },
    ],
    { 'sistema-de-ascenso': 'Otro', ajedrez: 'Ajedrez avanzado' }
  );
  assert.equal(raiz.name, 'Sistema de Ascenso');
  assert.equal(premio.name, 'Ajedrez avanzado');
  assert.equal(premio.nameOriginal, 'Ajedrez');
  assert.ok(motivoParaNoRenombrar(raiz, 'Otro'));
  assert.equal(motivoParaNoRenombrar(premio, 'Nuevo'), '');
});

const { aplicarImagenes } = await import('../../src/utils/premios-personalizados.mjs');

test('la imagen nueva manda sobre la del catálogo', () => {
  const [a, b] = aplicarImagenes([{ id: 'a' }, { id: 'b' }], {
    a: 'https://firebasestorage.googleapis.com/a.webp',
    b: 'javascript:alert(1)',
  });
  assert.equal(a.imagenUrl, 'https://firebasestorage.googleapis.com/a.webp');
  assert.equal(b.imagenUrl, undefined);
});

const { quitarEliminados } = await import('../../src/utils/premios-personalizados.mjs');

test('eliminar una carpeta quita también lo que tiene dentro', () => {
  const arbol = [
    { id: 'raiz', parentId: null },
    { id: 'carpeta', parentId: 'raiz' },
    { id: 'premio', parentId: 'carpeta' },
    { id: 'otro', parentId: 'raiz' },
  ];
  assert.deepEqual(
    quitarEliminados(arbol, { carpeta: true }).map((n) => n.id),
    ['raiz', 'otro']
  );
});
