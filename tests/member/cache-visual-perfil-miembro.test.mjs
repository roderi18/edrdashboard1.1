import test from 'node:test';
import assert from 'node:assert/strict';

import {
  recordarImagenDelPerfil,
  imagenDelPerfilYaResuelta,
  recordarInsigniasDelPerfil,
  leerInsigniasDelPerfilEnCache,
} from '../../src/utils/cache-visual-perfil-miembro.mjs';

test('conserva las insignias por miembro y por tipo durante la sesion', () => {
  assert.equal(leerInsigniasDelPerfilEnCache('cintas', 91001), undefined);

  recordarInsigniasDelPerfil('cintas', 91001, [{ id: 'cinta-1' }]);
  recordarInsigniasDelPerfil('medallas', 91001, [{ id: 'medalla-1' }]);
  recordarInsigniasDelPerfil('cintas', 91002, []);

  assert.deepEqual(leerInsigniasDelPerfilEnCache('cintas', 91001), [{ id: 'cinta-1' }]);
  assert.deepEqual(leerInsigniasDelPerfilEnCache('medallas', 91001), [{ id: 'medalla-1' }]);
  assert.deepEqual(leerInsigniasDelPerfilEnCache('cintas', 91002), []);
  assert.equal(leerInsigniasDelPerfilEnCache('pines', 91001), undefined);
});

test('recuerda las imagenes que ya terminaron de cargar o fallar', () => {
  const url = 'https://example.test/perfil-91001.webp';

  assert.equal(imagenDelPerfilYaResuelta(url), false);
  recordarImagenDelPerfil(url);
  assert.equal(imagenDelPerfilYaResuelta(url), true);
});
