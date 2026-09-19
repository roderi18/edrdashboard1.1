import test from 'node:test';
import { register } from 'node:module';
import assert from 'node:assert/strict';

// El codigo REAL, por el mismo alias con el que lo importa la aplicacion.
register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

const {
  prefijoDeCategoriaProducto,
  siguienteNumeroCodigoProducto,
  formatearCodigoProducto,
  generarSiguienteCodigoProducto,
} = await import('src/utils/producto-codigo.mjs');

// ----------------------------------------------------------------------
// EL CODIGO DE PRODUCTO SE ARMA SOLO A PARTIR DE LA CATEGORIA.
//
// /product/new pedia escribir el codigo a mano: se repetian, no seguian un
// orden y cada quien inventaba su propio formato. Ahora sale de la categoria
// elegida y sigue la secuencia de lo que ya existe en esa categoria.
// ----------------------------------------------------------------------

test('cada categoria de fabrica tiene su prefijo fijo', () => {
  assert.equal(prefijoDeCategoriaProducto('insignias-emblemas'), 'INS-EMB');
  assert.equal(prefijoDeCategoriaProducto('cintas'), 'CIN');
  assert.equal(prefijoDeCategoriaProducto('barras-numeros'), 'BAR-NUM');
  assert.equal(prefijoDeCategoriaProducto('parches'), 'PAR');
  assert.equal(prefijoDeCategoriaProducto('uniformes'), 'UNI');
  assert.equal(prefijoDeCategoriaProducto('accesorios'), 'ACC');
  assert.equal(prefijoDeCategoriaProducto('materiales-manuales'), 'MAT');
  assert.equal(prefijoDeCategoriaProducto('campamentos-especiales'), 'CAMP-ART');
  assert.equal(prefijoDeCategoriaProducto('pines'), 'PIN');
});

test('una categoria nueva usa las tres primeras letras de su nombre', () => {
  assert.equal(prefijoDeCategoriaProducto('recuerdos-y-regalos', 'Recuerdos y Regalos'), 'REC');
  // Sin acentos ni espacios, aunque el nombre empiece con ellos.
  assert.equal(prefijoDeCategoriaProducto('exito-personal', 'Éxito personal'), 'EXI');
});

test('el numero sigue la secuencia de lo que ya existe en esa categoria', () => {
  assert.equal(siguienteNumeroCodigoProducto('CIN', []), 1);
  assert.equal(siguienteNumeroCodigoProducto('CIN', ['CIN-001', 'CIN-002']), 3);
  // Un hueco en medio no se rellena: siempre sigue del mas alto.
  assert.equal(siguienteNumeroCodigoProducto('CIN', ['CIN-001', 'CIN-005']), 6);
  // Los codigos de otra categoria no cuentan.
  assert.equal(siguienteNumeroCodigoProducto('CIN', ['ACC-001', 'ACC-002']), 1);
});

test('el codigo completo junta el prefijo y el numero de tres cifras', () => {
  assert.equal(formatearCodigoProducto('CIN', 1), 'CIN-001');
  assert.equal(formatearCodigoProducto('CAMP-ART', 12), 'CAMP-ART-012');
});

test('generarSiguienteCodigoProducto arma el codigo entero de una vez', () => {
  assert.equal(
    generarSiguienteCodigoProducto({ categoria: 'accesorios', codigosExistentes: ['ACC-001'] }),
    'ACC-002'
  );
  assert.equal(
    generarSiguienteCodigoProducto({
      categoria: 'recuerdos-y-regalos',
      etiqueta: 'Recuerdos y Regalos',
      codigosExistentes: [],
    }),
    'REC-001'
  );
});
