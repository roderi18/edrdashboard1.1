import test from 'node:test';
import assert from 'node:assert/strict';

import ExcelJS from 'exceljs';

import { buildMemberTemplateWorkbook } from '../../src/server/member-template-workbook.js';

test('genera una plantilla con instrucciones, catálogos y desplegables vigentes', async () => {
  const buffer = await buildMemberTemplateWorkbook(
    [
      { id: 18, nombre: 'Tribu de Judá', numero: '18' },
      { id: 22, nombre: 'Leones de Sion', numero: '22' },
    ],
    { defaultDestId: '18' }
  );
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const instructions = workbook.getWorksheet('Instrucciones');
  const members = workbook.getWorksheet('Miembros');
  const catalogs = workbook.getWorksheet('Catálogos');

  assert.deepEqual(
    workbook.worksheets.map((worksheet) => worksheet.name),
    ['Instrucciones', 'Miembros', 'Catálogos']
  );
  assert.equal(workbook.views[0].activeTab, 0);
  assert.equal(instructions.getCell('A1').value, 'Plantilla para creación masiva de miembros');
  assert.match(instructions.getCell('A3').value, /Propósito: registrar varios miembros/);
  assert.deepEqual(instructions.getRow(8).values.slice(1), [
    'Campo',
    'Obligatorio',
    'Formato',
    'Ejemplo',
    'Descripción',
  ]);
  assert.deepEqual(instructions.getRow(9).values.slice(1, 5), [
    'Nombre',
    'Sí',
    'Texto: nombre completo',
    'Roderi Daniel Peña Rosario',
  ]);
  assert.deepEqual(instructions.getRow(10).values.slice(1, 5), [
    'Fecha_Nacimiento',
    'No',
    'DD-MM-AAAA',
    '18-06-2000',
  ]);
  assert.deepEqual(instructions.getRow(11).values.slice(1, 5), [
    'Teléfono',
    'No',
    '10 dígitos, sin +1, espacios ni guiones',
    '8297878833',
  ]);

  assert.deepEqual(members.getRow(1).values.slice(1), [
    'Nombre',
    'Fecha_Nacimiento',
    'Teléfono',
    'Correo',
    'Destacamento',
    'Posición_Destacamento',
    'Posición_Nacional',
    'Size_T-Shirt',
    'Sexo',
  ]);
  assert.equal(members.getCell('E2').value, 'Tribu de Judá 18');
  assert.match(members.getCell('E2').note, /asignado automáticamente/);
  assert.equal(catalogs.getCell('A2').value, 'Leones de Sion 22');
  assert.equal(catalogs.getCell('A3').value, 'Tribu de Judá 18');
  assert.equal(catalogs.getColumn('B').values.includes('Coordinador de Destacamento'), true);
  assert.equal(catalogs.getColumn('C').values.includes('Director Nacional'), true);
  assert.equal(catalogs.getColumn('D').values.includes('M'), true);
  assert.equal(catalogs.getColumn('E').values.includes('M'), true);

  assert.deepEqual(members.getCell('E2').dataValidation.formulae, ['ListaDestacamentos']);
  assert.deepEqual(members.getCell('F501').dataValidation.formulae, [
    'ListaPosicionesDestacamento',
  ]);
  assert.equal(members.getCell('I501').dataValidation.showErrorMessage, true);
  assert.equal(members.getCell('I501').dataValidation.errorStyle, 'stop');
});
