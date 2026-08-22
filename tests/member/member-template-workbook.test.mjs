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
  assert.equal(instructions.getCell('A7').value, 'Cuenta de acceso y fotografía');
  assert.match(instructions.getCell('A8').value, /generará un código de miembro/);
  assert.match(
    instructions.getCell('A8').value,
    /contraseña inicial será ese mismo código en minúsculas/
  );
  assert.match(instructions.getCell('A8').value, /primer ingreso/);
  assert.match(instructions.getCell('A8').value, /perfil dentro de la aplicación/);
  assert.deepEqual(instructions.getRow(11).values.slice(1), [
    'Campo',
    'Obligatorio',
    'Formato',
    'Ejemplo',
    'Descripción',
  ]);
  assert.deepEqual(instructions.getRow(12).values.slice(1, 5), [
    'Nombre',
    'Sí',
    'Texto: nombre o nombres',
    'Roderi Daniel',
  ]);
  assert.deepEqual(instructions.getRow(13).values.slice(1, 5), [
    'Apellido',
    'Sí',
    'Texto: apellido o apellidos',
    'Peña Rosario',
  ]);
  assert.deepEqual(instructions.getRow(14).values.slice(1, 5), [
    'Fecha_Nacimiento',
    'No',
    'DD-MM-AAAA',
    '18-06-2000',
  ]);
  assert.deepEqual(instructions.getRow(15).values.slice(1, 5), [
    'Teléfono',
    'No',
    '10 dígitos, sin +1, espacios ni guiones',
    '8297878833',
  ]);
  assert.deepEqual(instructions.getRow(17).values.slice(1, 5), [
    'Provincia',
    'No',
    'Seleccionar de la lista',
    'Santo Domingo',
  ]);
  assert.deepEqual(instructions.getRow(20).values.slice(1, 5), [
    'Calle / número',
    'No',
    'Texto libre: calle y número juntos',
    'Rey David 16',
  ]);

  assert.deepEqual(members.getRow(1).values.slice(1, 15), [
    'Nombre',
    'Apellido',
    'Fecha_Nacimiento',
    'Teléfono',
    'Correo',
    'Provincia',
    'Municipio',
    'Sector',
    'Calle / número',
    'Destacamento',
    'Posición_Destacamento',
    'Posición_Nacional',
    'Size_T-Shirt',
    'Sexo',
  ]);
  assert.ok(!members.autoFilter);
  assert.equal(members.getCell('J2').value, 'Tribu de Judá 18');
  assert.match(members.getCell('J2').note, /asignado automáticamente/);
  assert.equal(members.getColumn('O').hidden, true);
  assert.equal(members.getColumn('P').hidden, true);
  assert.match(members.getCell('O2').value.formula, /IdsProvincias/);
  assert.match(members.getCell('P2').value.formula, /IdsMunicipios_P/);
  assert.equal(catalogs.getCell('A2').value, 'Leones de Sion 22');
  assert.equal(catalogs.getCell('A3').value, 'Tribu de Judá 18');
  assert.equal(catalogs.getColumn('B').values.includes('Coordinador de Destacamento'), true);
  assert.equal(catalogs.getColumn('C').values.includes('Director Nacional'), true);
  assert.equal(catalogs.getColumn('D').values.includes('M'), true);
  assert.equal(catalogs.getColumn('E').values.includes('M'), true);
  assert.equal(catalogs.getColumn('F').values.includes('Santo Domingo'), true);
  assert.equal(catalogs.getColumn('H').values.includes('Santo Domingo Este'), true);
  assert.equal(catalogs.getColumn('K').values.includes('Ensanche Ozama'), true);

  assert.deepEqual(members.getCell('F2').dataValidation.formulae, ['ListaProvincias']);
  assert.deepEqual(members.getCell('G2').dataValidation.formulae, [
    'INDIRECT(IF($O2="","ListaVacia","Municipios_P"&$O2))',
  ]);
  assert.deepEqual(members.getCell('H501').dataValidation.formulae, [
    'INDIRECT(IF($P501="","ListaVacia","Sectores_M"&$P501))',
  ]);
  assert.deepEqual(members.getCell('J2').dataValidation.formulae, ['ListaDestacamentos']);
  assert.deepEqual(members.getCell('K501').dataValidation.formulae, [
    'ListaPosicionesDestacamento',
  ]);
  assert.equal(members.getCell('N501').dataValidation.showErrorMessage, true);
  assert.equal(members.getCell('N501').dataValidation.errorStyle, 'stop');

  const definedNames = workbook.definedNames.model.map((item) => item.name);
  assert.equal(definedNames.includes('ListaProvincias'), true);
  assert.equal(definedNames.includes('Municipios_P32'), true);
  assert.equal(definedNames.includes('Sectores_M152'), true);
});
