// ----------------------------------------------------------------------
// CINTAS Y MEDALLAS AÑADIDAS DESDE EXPLORA DESIGNER.
//
// Qué se quería evitar: para sumar una cinta había que dejar la imagen en la
// carpeta pública y además tocar código, y en producción nadie puede escribir en
// esa carpeta. Ahora el Administrador Global la añade desde el Designer con
// imagen, nombre y descripción. Estas pruebas cuidan que:
//  - no se pueda dar de alta sin las tres cosas;
//  - una ficha rota o con una imagen de fuera no se pinte;
//  - una vez registrada, la cinta sea del catálogo como las demás: se encuentra,
//    va detrás de las de fábrica y entra en el orden global.
// ----------------------------------------------------------------------

import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

const {
  TIPOS_INSIGNIA,
  separarInsignias,
  idDeInsigniaNueva,
  validarInsigniaNueva,
  insigniaDesdeDocumento,
} = await import('src/utils/insignias-personalizadas.mjs');
const {
  catalogoEnOrden,
  catalogoDeCintas,
  obtenerCintaPerfil,
  normalizarOrdenGlobal,
  CATALOGO_CINTAS_PERFIL,
  registrarCintasPersonalizadas,
} = await import('src/utils/cintas-perfil.mjs');

const URL_BUENA = (tipo, id) =>
  `https://firebasestorage.googleapis.com/v0/b/erd.appspot.com/o/everest%2Finsignias-${tipo}%2F${id}.webp?alt=media&token=x`;

const ficha = (tipo, id, extra = {}) => ({
  id,
  tipo,
  nombre: `Nueva ${tipo}`,
  descripcion: 'Se da a quien…',
  src: URL_BUENA(tipo, id),
  ...extra,
});

test('no se da de alta sin imagen, nombre y descripción', () => {
  const base = { tipo: TIPOS_INSIGNIA.CINTA, nombre: 'A', descripcion: 'B', tieneImagen: true };

  assert.equal(validarInsigniaNueva(base), '');
  assert.match(validarInsigniaNueva({ ...base, tieneImagen: false }), /imagen/);
  assert.match(validarInsigniaNueva({ ...base, nombre: '   ' }), /nombre/);
  assert.match(validarInsigniaNueva({ ...base, descripcion: '' }), /descripción/);
  assert.match(validarInsigniaNueva({ ...base, tipo: 'parche' }), /Tipo/);
});

test('una ficha rota o con una imagen de fuera de nuestro Storage no se pinta', () => {
  assert.ok(insigniaDesdeDocumento(ficha('cinta', 'p1')));
  assert.equal(
    insigniaDesdeDocumento(ficha('cinta', 'p1', { src: 'https://otro.com/a.webp' })),
    null
  );
  assert.equal(insigniaDesdeDocumento(ficha('cinta', 'cinta-rara')), null);
  assert.equal(insigniaDesdeDocumento(ficha('cinta', 'p1', { nombre: '' })), null);
  assert.equal(insigniaDesdeDocumento(ficha('parche', 'p1')), null);
});

test('se separan por tipo y en orden de alta; la medalla va detrás de las de la carpeta', () => {
  const { cintas, medallas } = separarInsignias([
    ficha('cinta', 'p300'),
    ficha('medalla', 'p200'),
    ficha('cinta', 'p100'),
  ]);

  assert.deepEqual(
    cintas.map((cinta) => cinta.id),
    ['p100', 'p300']
  );
  assert.equal(medallas[0].srcPequena, medallas[0].src);
  assert.equal(medallas[0].numero, Number.MAX_SAFE_INTEGER);
  assert.match(idDeInsigniaNueva(1737000000000), /^p1737000000000$/);
});

test('una cinta registrada es del catálogo: se encuentra, va al final y entra en el orden', () => {
  const { cintas } = separarInsignias([ficha('cinta', 'p500'), ficha('cinta', 'p400')]);

  registrarCintasPersonalizadas(cintas);

  try {
    assert.equal(obtenerCintaPerfil('P400')?.nombre, 'Nueva cinta');
    assert.equal(catalogoDeCintas().length, CATALOGO_CINTAS_PERFIL.length + 2);
    assert.deepEqual(
      catalogoEnOrden()
        .slice(-3)
        .map((cinta) => cinta.id),
      ['z6', 'p400', 'p500']
    );
    // Un orden guardado antes de que existiera la deja al final, no la pierde.
    assert.deepEqual(normalizarOrdenGlobal(['3', '1']).slice(-2), ['p400', 'p500']);
  } finally {
    registrarCintasPersonalizadas([]);
  }

  assert.equal(obtenerCintaPerfil('p400'), null);
  assert.equal(catalogoDeCintas(), CATALOGO_CINTAS_PERFIL);
});

test('una ficha no puede tapar una cinta de fábrica con su mismo id', () => {
  registrarCintasPersonalizadas([{ id: '3', nombre: 'Impostora', src: 'x' }]);

  try {
    assert.notEqual(obtenerCintaPerfil('3')?.nombre, 'Impostora');
    assert.equal(catalogoDeCintas().length, CATALOGO_CINTAS_PERFIL.length);
  } finally {
    registrarCintasPersonalizadas([]);
  }
});
