import test from 'node:test';
import assert from 'node:assert/strict';

import { sanearDiseno } from '../../src/utils/everest/diseno.mjs';

test('las propiedades del lienzo sirven en cualquier bloque y sobreviven al saneado', () => {
  const diseno = {
    elementosVisuales: {
      2: { texto: 'Nuevo título', x: 12, y: -4, fontSize: 32, opacity: 0.8 },
    },
    capasVisuales: [
      {
        id: 'titulo-extra',
        tipo: 'texto',
        texto: 'Inscríbete',
        x: 10,
        y: 60,
        width: 35,
        height: 18,
        estilo: { color: '#FFFFFF', fontWeight: '700' },
      },
    ],
  };

  for (const id of ['bienvenida', 'proxima-actividad', 'historias', 'comunicados', 'lema']) {
    assert.deepEqual(sanearDiseno(id, diseno), diseno);
  }
});

test('el lienzo rechaza CSS peligroso, medidas imposibles e imágenes externas sin https', () => {
  assert.equal(
    sanearDiseno('historias', { elementosVisuales: { 0: { color: 'url(javascript:alert(1))' } } }),
    null
  );
  assert.equal(sanearDiseno('historias', { elementosVisuales: { 0: { opacity: 2 } } }), null);
  assert.equal(
    sanearDiseno('historias', {
      capasVisuales: [
        {
          id: 'foto',
          tipo: 'imagen',
          src: 'javascript:alert(1)',
          x: 0,
          y: 0,
          width: 20,
          height: 20,
        },
      ],
    }),
    null
  );
});

test('un diseño sin opciones visuales sigue vacío', () => {
  assert.deepEqual(sanearDiseno('proxima-actividad', {}), {});
});
