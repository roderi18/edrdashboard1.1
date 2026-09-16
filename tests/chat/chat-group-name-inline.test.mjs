import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { resolveGroupNameEdit } from '../../src/sections/chat/utils/group-name-edit.mjs';

const headerSource = await readFile(
  new URL('../../src/sections/chat/chat-header-details.jsx', import.meta.url),
  'utf8'
);

test('un nombre vacío conserva el nombre actual del grupo', () => {
  assert.deepEqual(resolveGroupNameEdit('Equipo Central', '   '), {
    name: 'Equipo Central',
    shouldSave: false,
  });
});

test('un nombre nuevo se limpia y se guarda', () => {
  assert.deepEqual(resolveGroupNameEdit('Equipo Central', '  Coordinación Central  '), {
    name: 'Coordinación Central',
    shouldSave: true,
  });
});

test('el encabezado edita el nombre en línea y no abre un diálogo de grupo', () => {
  assert.match(headerSource, /editingGroupName \? \(/);
  assert.match(headerSource, /onBlur=\{handleGroupNameBlur\}/);
  assert.match(headerSource, /event\.key === 'Enter'/);
  assert.match(headerSource, /event\.key === 'Escape'/);
  assert.doesNotMatch(headerSource, /open=\{groupEditOpen\}/);
});

test('el nombre se muestra de forma optimista mientras se guarda en segundo plano', () => {
  assert.match(headerSource, /const \[optimisticGroupName, setOptimisticGroupName\] = useState\(''\)/);
  assert.match(headerSource, /const groupDisplayName = optimisticGroupName \|\| persistedGroupDisplayName/);
  assert.match(
    headerSource,
    /flushSync\(\(\) => \{\s*setOptimisticGroupName\(edit\.name\);\s*setEditingGroupName\(false\);\s*setGroupName\(''\);\s*setSavingGroup\(true\);/
  );
  assert.match(headerSource, /event\.key === 'Enter'[\s\S]*void handleSubmitGroup\(\)/);
  assert.doesNotMatch(headerSource, /event\.currentTarget\.blur\(\)/);
  assert.match(headerSource, /catch \(error\) \{[\s\S]*setOptimisticGroupName\(''\)/);
});
