import ExcelJS from 'exceljs';

import { DIRECTIVA_POSITIONS } from '../catalogs/directiva-positions.js';
import { MEMBER_GENDERS, MEMBER_SHIRT_SIZES } from '../catalogs/member-catalogs.js';

const MEMBER_HEADERS = [
  'Nombre',
  'Fecha_Nacimiento',
  'Teléfono',
  'Correo',
  'Destacamento',
  'Posición_Destacamento',
  'Posición_Nacional',
  'Size_T-Shirt',
  'Sexo',
];

const CATALOG_HEADERS = [
  'Destacamento',
  'Posición_Destacamento',
  'Posición_Nacional',
  'Size_T-Shirt',
  'Sexo',
];

const FIELD_GUIDE_HEADERS = ['Campo', 'Obligatorio', 'Formato', 'Ejemplo', 'Descripción'];

const FIELD_GUIDE_ROWS = [
  [
    'Nombre',
    'Sí',
    'Texto: nombre completo',
    'Roderi Daniel Peña Rosario',
    'Nombre y apellidos de la persona.',
  ],
  [
    'Fecha_Nacimiento',
    'No',
    'DD-MM-AAAA',
    '18-06-2000',
    'Al cargar se guardará en la base de datos como AAAA-MM-DD. Las fechas inválidas se informarán en el registro de carga.',
  ],
  [
    'Teléfono',
    'No',
    '10 dígitos, sin +1, espacios ni guiones',
    '8297878833',
    'El proceso de carga agregará +1 automáticamente.',
  ],
  ['Correo', 'No', 'Correo electrónico válido', 'rdpr18@gmail.com', 'Puede dejarse vacío.'],
  [
    'Destacamento',
    'Sí',
    'Seleccionar de la lista',
    'Tribu de Judá 18',
    'Debe coincidir con un destacamento vigente del catálogo.',
  ],
  [
    'Posición_Destacamento',
    'No',
    'Seleccionar de la lista',
    'Coordinador Asistente de Destacamento',
    'Puede dejarse vacío si el miembro no ocupa una posición de destacamento.',
  ],
  [
    'Posición_Nacional',
    'No',
    'Seleccionar de la lista',
    'Director Nacional',
    'Puede dejarse vacío si el miembro no ocupa una posición nacional.',
  ],
  [
    'Size_T-Shirt',
    'No',
    'Seleccionar de la lista',
    'M',
    'Talla de camiseta según los valores vigentes del catálogo.',
  ],
  [
    'Sexo',
    'No',
    'Seleccionar de la lista',
    'M',
    'M corresponde a masculino y F corresponde a femenino.',
  ],
];

const uniqueSorted = (values) =>
  [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right, 'es'));

const getPositionLabel = (position) =>
  position.nombreDivision
    ? `${position.nombreCargo} (${position.nombreDivision})`
    : position.nombreCargo;

const getSelectablePositions = (level) =>
  uniqueSorted(
    DIRECTIVA_POSITIONS.filter(
      (position) =>
        position.nivel === level && position.asignable === true && position.activo !== false
    ).map(getPositionLabel)
  );

const getDestLabel = (dest) =>
  [dest?.nombre ?? dest?.name ?? '', dest?.numero ?? dest?.destNumber ?? '']
    .filter(Boolean)
    .join(' ')
    .trim();

const getDestIds = (dest) =>
  [dest?.id, dest?.idDestacamento, dest?.destId]
    .filter((value) => value !== null && value !== undefined && value !== '')
    .map(String);

const styleHeader = (worksheet, cellCount, color) => {
  const row = worksheet.getRow(1);

  row.height = 30;
  row.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
    if (columnNumber > cellCount) return;

    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { vertical: 'middle', wrapText: true };
  });
};

const addInstructionsSheet = (workbook) => {
  const instructions = workbook.addWorksheet('Instrucciones', {
    views: [{ state: 'frozen', ySplit: 8, showGridLines: false }],
  });

  instructions.mergeCells('A1:E1');
  instructions.getCell('A1').value = 'Plantilla para creación masiva de miembros';
  instructions.getCell('A1').fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1F4E78' },
  };
  instructions.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
  instructions.getCell('A1').alignment = { vertical: 'middle', horizontal: 'center' };
  instructions.getRow(1).height = 34;

  instructions.mergeCells('A3:E3');
  instructions.getCell('A3').value =
    'Propósito: registrar varios miembros en el sistema mediante una sola carga. Cada fila de la hoja “Miembros” representa una persona.';
  instructions.getCell('A3').alignment = { vertical: 'middle', wrapText: true };
  instructions.getCell('A3').font = { bold: true, color: { argb: 'FF1F4E78' } };
  instructions.getRow(3).height = 34;

  instructions.mergeCells('A5:E5');
  instructions.getCell('A5').value = 'Antes de llenar la plantilla';
  instructions.getCell('A5').font = { bold: true, size: 12, color: { argb: 'FF1F4E78' } };

  instructions.mergeCells('A6:E6');
  instructions.getCell('A6').value =
    'No cambie ni elimine los encabezados de “Miembros”. Use los desplegables disponibles y no edite la hoja “Catálogos”. Los campos marcados “Sí” son obligatorios.';
  instructions.getCell('A6').alignment = { vertical: 'middle', wrapText: true };
  instructions.getRow(6).height = 34;

  instructions.addRow([]);
  instructions.addRow(FIELD_GUIDE_HEADERS);
  FIELD_GUIDE_ROWS.forEach((row) => instructions.addRow(row));

  const headerRow = instructions.getRow(8);
  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF548235' } };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { vertical: 'middle', wrapText: true };
  });

  instructions.columns = [
    { width: 28 },
    { width: 14 },
    { width: 38 },
    { width: 38 },
    { width: 72 },
  ];

  for (let rowNumber = 9; rowNumber <= 8 + FIELD_GUIDE_ROWS.length; rowNumber += 1) {
    const row = instructions.getRow(rowNumber);
    row.height = 44;
    row.eachCell((cell, columnNumber) => {
      cell.alignment = { vertical: 'middle', wrapText: true };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: rowNumber % 2 === 0 ? 'FFE2F0D9' : 'FFF7FBF5' },
      };
      cell.border = {
        bottom: { style: 'thin', color: { argb: 'FFD9E2F3' } },
      };

      if (columnNumber === 2) {
        cell.font = {
          bold: true,
          color: { argb: cell.value === 'Sí' ? 'FFC00000' : 'FF548235' },
        };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      }
    });
  }

  instructions.autoFilter = 'A8:E17';
  return instructions;
};

const addNamedCatalog = ({ workbook, column, values, name }) => {
  const lastRow = values.length + 1;
  workbook.definedNames.add(`Catálogos!$${column}$2:$${column}$${lastRow}`, name);
};

const addValidation = ({ worksheet, column, formula, fieldName }) => {
  for (let row = 2; row <= 501; row += 1) {
    worksheet.getCell(`${column}${row}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [formula],
      showErrorMessage: true,
      errorStyle: 'stop',
      errorTitle: 'Valor no permitido',
      error: `Selecciona un valor existente para ${fieldName}.`,
    };
  }
};

export const buildMemberTemplateWorkbook = async (dests = [], { defaultDestId = '' } = {}) => {
  const destacamentos = uniqueSorted(dests.map(getDestLabel));
  const defaultDest = defaultDestId
    ? dests.find((dest) => getDestIds(dest).includes(String(defaultDestId)))
    : null;
  const defaultDestLabel = defaultDest ? getDestLabel(defaultDest) : '';

  if (!destacamentos.length) {
    throw new Error('El catálogo de destacamentos está vacío.');
  }

  const posicionesDestacamento = getSelectablePositions('destacamento');
  const posicionesNacionales = getSelectablePositions('nacional');
  const tallas = MEMBER_SHIRT_SIZES.map((item) => item.value);
  const sexos = MEMBER_GENDERS.map((item) => item.value);
  const catalogs = [destacamentos, posicionesDestacamento, posicionesNacionales, tallas, sexos];
  const maxCatalogRows = Math.max(...catalogs.map((values) => values.length));

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Sistema de Exploradores';
  workbook.created = new Date();
  workbook.views = [{ activeTab: 0, firstSheet: 0, visibility: 'visible' }];

  addInstructionsSheet(workbook);

  const members = workbook.addWorksheet('Miembros', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  members.addRow(MEMBER_HEADERS);
  members.addRow([]);
  if (defaultDestLabel) {
    members.getCell('E2').value = defaultDestLabel;
    members.getCell('E2').note =
      'Destacamento asignado automáticamente según el usuario que descargó la plantilla.';
  }
  members.autoFilter = 'A1:I1';
  members.columns = [
    { width: 31 },
    { width: 19, style: { numFmt: 'dd-mm-yyyy' } },
    { width: 17, style: { numFmt: '@' } },
    { width: 27 },
    { width: 26 },
    { width: 42 },
    { width: 39 },
    { width: 17 },
    { width: 11 },
  ];
  styleHeader(members, MEMBER_HEADERS.length, 'FF1F4E78');

  const catalogSheet = workbook.addWorksheet('Catálogos', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  catalogSheet.addRow(CATALOG_HEADERS);

  for (let index = 0; index < maxCatalogRows; index += 1) {
    catalogSheet.addRow(catalogs.map((values) => values[index] ?? ''));
  }

  catalogSheet.columns = [
    { width: 27 },
    { width: 43 },
    { width: 43 },
    { width: 17 },
    { width: 12 },
  ];
  styleHeader(catalogSheet, CATALOG_HEADERS.length, 'FF548235');

  addNamedCatalog({
    workbook,
    column: 'A',
    values: destacamentos,
    name: 'ListaDestacamentos',
  });
  addNamedCatalog({
    workbook,
    column: 'B',
    values: posicionesDestacamento,
    name: 'ListaPosicionesDestacamento',
  });
  addNamedCatalog({
    workbook,
    column: 'C',
    values: posicionesNacionales,
    name: 'ListaPosicionesNacionales',
  });
  addNamedCatalog({ workbook, column: 'D', values: tallas, name: 'ListaTallas' });
  addNamedCatalog({ workbook, column: 'E', values: sexos, name: 'ListaSexos' });

  addValidation({
    worksheet: members,
    column: 'E',
    formula: 'ListaDestacamentos',
    fieldName: 'Destacamento',
  });
  addValidation({
    worksheet: members,
    column: 'F',
    formula: 'ListaPosicionesDestacamento',
    fieldName: 'Posición_Destacamento',
  });
  addValidation({
    worksheet: members,
    column: 'G',
    formula: 'ListaPosicionesNacionales',
    fieldName: 'Posición_Nacional',
  });
  addValidation({
    worksheet: members,
    column: 'H',
    formula: 'ListaTallas',
    fieldName: 'Size_T-Shirt',
  });
  addValidation({
    worksheet: members,
    column: 'I',
    formula: 'ListaSexos',
    fieldName: 'Sexo',
  });

  return workbook.xlsx.writeBuffer();
};
