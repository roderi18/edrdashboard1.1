import test from 'node:test';
import assert from 'node:assert/strict';

import { readExcelRows } from '../../src/utils/excel-upload.js';
import { buildMemberTemplateWorkbook } from '../../src/server/member-template-workbook.js';

test('lee Miembros aunque Instrucciones sea la primera hoja de la plantilla', async () => {
  const buffer = await buildMemberTemplateWorkbook(
    [{ id: 18, nombre: 'Tribu de Judá', numero: '18' }],
    { defaultDestId: 18 }
  );
  const rows = await readExcelRows({
    name: 'plantilla-miembros.xlsx',
    arrayBuffer: async () => buffer,
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].Destacamento, 'Tribu de Judá 18');
  assert.equal(rows[0].Nombre, '');
});
