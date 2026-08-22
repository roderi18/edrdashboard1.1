import test from 'node:test';
import assert from 'node:assert/strict';

import { MemberValidationSchema } from '../../src/models/member-schema.js';

// El formulario recibe en `handleSubmit` lo que devuelve el schema, no los
// valores crudos: cualquier campo que no este declarado se pierde por el camino.
// La foto elegida al crear un miembro se subia despues del alta leyendo ese
// objeto, asi que al descartarla la subida no llegaba a ejecutarse nunca.
test('conserva la foto seleccionada al validar', () => {
  const foto = { name: 'perfil.webp' };

  const datos = MemberValidationSchema.parse({
    firstName: 'Roderi Daniel',
    lastName: 'Peña Rosario',
    avatarUrl: foto,
  });

  assert.equal(datos.avatarUrl, foto);
});

test('la foto es opcional', () => {
  const datos = MemberValidationSchema.parse({ firstName: 'A', lastName: 'B' });

  assert.equal(datos.avatarUrl, undefined);
  assert.doesNotThrow(() =>
    MemberValidationSchema.parse({ firstName: 'A', lastName: 'B', avatarUrl: null })
  );
});

test('sigue exigiendo nombre y apellido', () => {
  assert.throws(() => MemberValidationSchema.parse({ firstName: '', lastName: 'B' }));
  assert.throws(() => MemberValidationSchema.parse({ firstName: 'A', lastName: '   ' }));
});
