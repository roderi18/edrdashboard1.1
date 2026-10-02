// ----------------------------------------------------------------------
// LA JERARQUÍA DE UNA DIRECTIVA PASADA COPIA LA DE HOY.
//
// Qué se rompía: la memoria de 2022-2026 se pintaba sin las casillas añadidas,
// quitadas y renombradas de hoy (Secretario Ejecutivo, Tesorero Ejecutivo,
// Presidente y Vicepresidente del Consejo Nacional; Secretario Nacional
// quitado), así que las dos jerarquías no se parecían. La organización pidió que
// todas las directivas pasadas copien exactamente el modelo, las formas y las
// posiciones de la actual: solo cambian las personas. El diseño (posiciones y
// líneas) ya era uno solo para todas (`entidadesDeDisenoDe`).
// ----------------------------------------------------------------------

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import '../soporte/resolver-alias-src.mjs';

const { entidadesDeDisenoDe } = await import('../../src/utils/directiva-cuatrienios.mjs');

const vista = readFileSync(
  new URL('../../src/sections/national/leadership/national-leadership-view.jsx', import.meta.url),
  'utf8'
);

test('el árbol de la memoria lleva las mismas casillas que el de hoy', () => {
  assert.match(
    vista,
    /arbolConCasillas\(obtenerDiagramaNacionalConOficiales\(\[\]\), 'nacional', casillasAnadidas\.todas\)/
  );
  assert.doesNotMatch(vista, /historico \? \[\] : casillasAnadidas\.todas/);
});

test('y el mismo diseño: no hay documento aparte por cuatrienio', () => {
  assert.deepEqual(entidadesDeDisenoDe({ idEntidad: '' }), {
    idEntidad: '',
    idEntidadRespaldo: '',
  });
});
