import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const ruta = new URL('../../src/app/api/members/route.js', import.meta.url);
const codigo = fs.readFileSync(ruta, 'utf8');

test('el padrón usa el endpoint paginado para no bloquear las fichas por 9 segundos', () => {
  assert.match(codigo, /GetAllMiembrosPagination/);
  assert.match(codigo, /method: 'POST'/);
  assert.match(codigo, /pageSize: MEMBERS_PAGE_SIZE/);
  assert.match(codigo, /NODE_ENV === 'development' \? 25_000 : 9_000/);
  assert.doesNotMatch(codigo, /api\/Miembros\/GetAllMiembros['`]/);
});

test('si hay varias páginas se obtienen todas y se conserva el caché por página', () => {
  assert.match(codigo, /totalPages/);
  assert.match(codigo, /Promise\.all/);
  assert.match(codigo, /`\$\{cacheKey\}:pagina:\$\{page\}`/);
  assert.match(codigo, /flatMap\(\(pagina\) => pagina\.items\)/);
});
