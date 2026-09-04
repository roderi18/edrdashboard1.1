import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

// La solicitud de acceso —al Historial, a la ficha, a la Dispensa— siempre le ha
// llegado al Coordinador de Destacamento Y a su Asistente. Lo que se nombraba en
// pantalla era solo al titular, y quien pedia el acceso se quedaba creyendo que
// dependia de una sola persona.

const { describirCoordinadores } = await import('src/services/member-info-access-service.js');

const TITULAR = {
  idMiembros: 1,
  nombre: 'Arsenio Leyba',
  cargo: 'coordinador_destacamento',
  etiquetaCargo: 'Coordinador de Destacamento',
};

const ASISTENTE = {
  idMiembros: 2,
  nombre: 'María Guillén',
  cargo: 'coordinador_asistente_destacamento',
  etiquetaCargo: 'Coordinador Asistente',
};

test('se nombra al Coordinador y a su Asistente, con su cargo', () => {
  const { etiqueta } = describirCoordinadores([TITULAR, ASISTENTE]);

  assert.equal(
    etiqueta,
    'Arsenio Leyba (Coordinador de Destacamento) y María Guillén (Coordinador Asistente)'
  );
});

test('el mensaje de confirmacion los nombra a los dos, sin el cargo', () => {
  const { nombres } = describirCoordinadores([TITULAR, ASISTENTE]);

  assert.equal(nombres, 'Arsenio Leyba y María Guillén');
});

test('con un solo coordinador no queda un "y" colgando', () => {
  const { etiqueta, nombres } = describirCoordinadores([TITULAR]);

  assert.equal(etiqueta, 'Arsenio Leyba (Coordinador de Destacamento)');
  assert.equal(nombres, 'Arsenio Leyba');
});

test('sin nadie en la directiva no se inventa un nombre', () => {
  const { etiqueta, nombres } = describirCoordinadores([]);

  assert.equal(etiqueta, '');
  assert.equal(nombres, '');
});
