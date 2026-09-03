import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const leer = (ruta) => fs.readFileSync(new URL(`../../${ruta}`, import.meta.url), 'utf8');

test('el resumen de seguidores se muestra junto al título de la pestaña', () => {
  const seguidores = leer('src/sections/user/profile-followers.jsx');
  const vista = leer('src/sections/user/view/user-profile-view.jsx');

  assert.match(seguidores, /<Typography variant="h4">Seguidores<\/Typography>/);
  assert.match(seguidores, /fNumber\(info\.totalFollowers\)/);
  assert.match(seguidores, /fNumber\(info\.totalFollowing\)/);
  assert.match(seguidores, /flexDirection: \{ xs: 'column', sm: 'row' \}/);
  assert.match(vista, /<ProfileFollowers followers=\{_userFollowers\} info=\{profileInfo\} \/>/);
});

test('el resumen deja de ocupar espacio en la portada principal', () => {
  const portada = leer('src/sections/user/profile-home.jsx');

  assert.doesNotMatch(portada, /renderFollows/);
  assert.doesNotMatch(portada, /info\.totalFollowers/);
  assert.doesNotMatch(portada, /info\.totalFollowing/);
});
