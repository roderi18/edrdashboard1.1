import ExcelJS from 'exceljs';

import barriosData from '../data/barrios.json' with { type: 'json' };
import { DIRECTIVA_POSITIONS } from '../catalogs/directiva-positions.js';
import seccionesData from '../data/secciones.json' with { type: 'json' };
import provinciasData from '../data/provincias.json' with { type: 'json' };
import municipiosData from '../data/municipios.json' with { type: 'json' };
import { MEMBER_GENDERS, MEMBER_SHIRT_SIZES } from '../catalogs/member-catalogs.js';

const MEMBER_HEADERS = [
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
];

const CATALOG_HEADERS = [
  'Destacamento',
  'Posición_Destacamento',
  'Posición_Nacional',
  'Size_T-Shirt',
  'Sexo',
  'Provincia',
  '__Provincia_ID',
  'Municipio',
  '__Municipio_ID',
  '__Municipio_Provincia_ID',
  'Sector',
  '__Sector_Municipio_ID',
  '__Lista_Vacía',
];

const FIELD_GUIDE_HEADERS = ['Campo', 'Obligatorio', 'Formato', 'Ejemplo', 'Descripción'];

const FIELD_GUIDE_ROWS = [
  [
    'Nombre',
    'Sí',
    'Texto: nombre o nombres',
    'Roderi Daniel',
    'Nombre o nombres de la persona, sin incluir los apellidos.',
  ],
  [
    'Apellido',
    'Sí',
    'Texto: apellido o apellidos',
    'Peña Rosario',
    'Apellido o apellidos de la persona, sin incluir los nombres.',
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
    'Provincia',
    'No',
    'Seleccionar de la lista',
    'Santo Domingo',
    'Al seleccionar la provincia se habilitan únicamente sus municipios.',
  ],
  [
    'Municipio',
    'No',
    'Seleccionar después de Provincia',
    'Santo Domingo Este',
    'El desplegable depende de la provincia elegida.',
  ],
  [
    'Sector',
    'No',
    'Seleccionar después de Municipio',
    'Ensanche Ozama',
    'El desplegable depende del municipio elegido.',
  ],
  [
    'Calle / número',
    'No',
    'Texto libre: calle y número juntos',
    'Rey David 16',
    'Es un solo campo. También admite valores como Duarte 12-A, Principal #18 o Calle 4 S/N.',
  ],
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

const municipalities = municipiosData.map((municipality, index) => ({
  ...municipality,
  id: index + 1,
}));

const sectionMunicipalityIds = new Map(
  seccionesData.map((section) => [String(section.id), Number(section.municipioId)])
);

const provinces = [...provinciasData].sort((left, right) =>
  left.nombre.localeCompare(right.nombre, 'es')
);

const municipalitiesByProvince = new Map(
  provinces.map((province) => [
    Number(province.id),
    municipalities
      .filter((municipality) => Number(municipality.provinciaId) === Number(province.id))
      .sort((left, right) => left.nombre.localeCompare(right.nombre, 'es')),
  ])
);

const sectorsByMunicipality = new Map();

barriosData.forEach((sector) => {
  const municipalityId = sectionMunicipalityIds.get(String(sector.seccionId));

  if (!municipalityId || !sector.nombre) return;

  const current = sectorsByMunicipality.get(municipalityId) ?? [];
  current.push(sector.nombre);
  sectorsByMunicipality.set(municipalityId, current);
});

sectorsByMunicipality.forEach((sectors, municipalityId) => {
  sectorsByMunicipality.set(municipalityId, uniqueSorted(sectors));
});

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
    views: [{ state: 'frozen', ySplit: 11, showGridLines: false }],
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
    'No cambie ni elimine los encabezados de “Miembros”. Use los desplegables disponibles y no edite la hoja “Catálogos”. Para la dirección, seleccione en orden Provincia → Municipio → Sector. Los campos marcados “Sí” son obligatorios.';
  instructions.getCell('A6').alignment = { vertical: 'middle', wrapText: true };
  instructions.getRow(6).height = 34;

  instructions.mergeCells('A7:E7');
  instructions.getCell('A7').value = 'Cuenta de acceso y fotografía';
  instructions.getCell('A7').fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFD9EAF7' },
  };
  instructions.getCell('A7').font = { bold: true, size: 12, color: { argb: 'FF1F4E78' } };
  instructions.getCell('A7').alignment = { vertical: 'middle' };
  instructions.getRow(7).height = 24;

  instructions.mergeCells('A8:E9');
  instructions.getCell('A8').value =
    'Al cargar una persona, el sistema generará un código de miembro y una contraseña inicial para ingresar a la aplicación. El código de miembro será el usuario y la contraseña inicial será ese mismo código en minúsculas. En el primer ingreso, la aplicación pedirá cambiar la contraseña antes de continuar. La foto no se carga desde esta plantilla; puede agregarse posteriormente en el perfil dentro de la aplicación.';
  instructions.getCell('A8').fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF2F7FB' },
  };
  instructions.getCell('A8').alignment = { vertical: 'middle', wrapText: true };
  instructions.getCell('A8').border = {
    bottom: { style: 'thin', color: { argb: 'FFB4C7E7' } },
  };
  instructions.getRow(8).height = 32;
  instructions.getRow(9).height = 32;

  instructions.getRow(11).values = FIELD_GUIDE_HEADERS;
  FIELD_GUIDE_ROWS.forEach((row, index) => {
    instructions.getRow(12 + index).values = row;
  });

  const headerRow = instructions.getRow(11);
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

  for (let rowNumber = 12; rowNumber <= 11 + FIELD_GUIDE_ROWS.length; rowNumber += 1) {
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

  instructions.autoFilter = `A11:E${11 + FIELD_GUIDE_ROWS.length}`;
  return instructions;
};

const addNamedRange = ({ workbook, column, startRow, endRow, name }) => {
  workbook.definedNames.add(`Catálogos!$${column}$${startRow}:$${column}$${endRow}`, name);
};

const addNamedCatalog = ({ workbook, column, values, name }) => {
  const lastRow = values.length + 1;
  addNamedRange({ workbook, column, startRow: 2, endRow: lastRow, name });
};

const addValidation = ({ worksheet, column, formula, fieldName }) => {
  for (let row = 2; row <= 501; row += 1) {
    const rowFormula = typeof formula === 'function' ? formula(row) : formula;

    worksheet.getCell(`${column}${row}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [rowFormula],
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
  const provinceNames = provinces.map((province) => province.nombre);
  const provinceIds = provinces.map((province) => province.id);
  const municipalityRows = provinces.flatMap((province) =>
    (municipalitiesByProvince.get(Number(province.id)) ?? []).map((municipality) => ({
      name: municipality.nombre,
      id: municipality.id,
      provinceId: province.id,
    }))
  );
  const sectorRows = municipalities.flatMap((municipality) =>
    (sectorsByMunicipality.get(municipality.id) ?? []).map((sector) => ({
      name: sector,
      municipalityId: municipality.id,
    }))
  );
  const catalogs = [
    destacamentos,
    posicionesDestacamento,
    posicionesNacionales,
    tallas,
    sexos,
    provinceNames,
    provinceIds,
    municipalityRows.map((row) => row.name),
    municipalityRows.map((row) => row.id),
    municipalityRows.map((row) => row.provinceId),
    sectorRows.map((row) => row.name),
    sectorRows.map((row) => row.municipalityId),
    [''],
  ];
  const maxCatalogRows = Math.max(...catalogs.map((values) => values.length));

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Sistema de Exploradores';
  workbook.created = new Date();
  workbook.views = [{ activeTab: 0, firstSheet: 0, visibility: 'visible' }];
  workbook.calcProperties.fullCalcOnLoad = true;
  workbook.calcProperties.forceFullCalc = true;
  workbook.calcProperties.calcMode = 'auto';

  addInstructionsSheet(workbook);

  const members = workbook.addWorksheet('Miembros', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  members.addRow([...MEMBER_HEADERS, '__Provincia_ID', '__Municipio_ID']);
  members.addRow([]);
  if (defaultDestLabel) {
    members.getCell('J2').value = defaultDestLabel;
    members.getCell('J2').note =
      'Destacamento asignado automáticamente según el usuario que descargó la plantilla.';
  }
  members.columns = [
    { width: 31 },
    { width: 31 },
    { width: 19, style: { numFmt: 'dd-mm-yyyy' } },
    { width: 17, style: { numFmt: '@' } },
    { width: 27 },
    { width: 24 },
    { width: 29 },
    { width: 31 },
    { width: 29, style: { numFmt: '@' } },
    { width: 26 },
    { width: 42 },
    { width: 39 },
    { width: 17 },
    { width: 11 },
    { width: 3, hidden: true },
    { width: 3, hidden: true },
  ];
  styleHeader(members, MEMBER_HEADERS.length, 'FF1F4E78');

  for (let row = 2; row <= 501; row += 1) {
    members.getCell(`O${row}`).value = {
      formula: `IFERROR(INDEX(IdsProvincias,MATCH(F${row},ListaProvincias,0)),"")`,
      result: '',
    };
    members.getCell(`P${row}`).value = {
      formula: `IFERROR(INDEX(INDIRECT("IdsMunicipios_P"&O${row}),MATCH(G${row},INDIRECT("Municipios_P"&O${row}),0)),"")`,
      result: '',
    };
  }

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
    { width: 25 },
    { width: 4, hidden: true },
    { width: 31 },
    { width: 4, hidden: true },
    { width: 4, hidden: true },
    { width: 35 },
    { width: 4, hidden: true },
    { width: 4, hidden: true },
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
  addNamedCatalog({ workbook, column: 'F', values: provinceNames, name: 'ListaProvincias' });
  addNamedCatalog({ workbook, column: 'G', values: provinceIds, name: 'IdsProvincias' });
  addNamedRange({ workbook, column: 'M', startRow: 2, endRow: 2, name: 'ListaVacia' });

  let municipalityStartRow = 2;
  provinces.forEach((province) => {
    const provinceMunicipalities = municipalitiesByProvince.get(Number(province.id)) ?? [];
    const municipalityEndRow = municipalityStartRow + provinceMunicipalities.length - 1;

    if (provinceMunicipalities.length) {
      addNamedRange({
        workbook,
        column: 'H',
        startRow: municipalityStartRow,
        endRow: municipalityEndRow,
        name: `Municipios_P${province.id}`,
      });
      addNamedRange({
        workbook,
        column: 'I',
        startRow: municipalityStartRow,
        endRow: municipalityEndRow,
        name: `IdsMunicipios_P${province.id}`,
      });
    }

    municipalityStartRow = municipalityEndRow + 1;
  });

  let sectorStartRow = 2;
  municipalities.forEach((municipality) => {
    const municipalitySectors = sectorsByMunicipality.get(municipality.id) ?? [];
    const sectorEndRow = sectorStartRow + municipalitySectors.length - 1;

    addNamedRange({
      workbook,
      column: municipalitySectors.length ? 'K' : 'M',
      startRow: municipalitySectors.length ? sectorStartRow : 2,
      endRow: municipalitySectors.length ? sectorEndRow : 2,
      name: `Sectores_M${municipality.id}`,
    });

    if (municipalitySectors.length) sectorStartRow = sectorEndRow + 1;
  });

  addValidation({
    worksheet: members,
    column: 'F',
    formula: 'ListaProvincias',
    fieldName: 'Provincia',
  });
  addValidation({
    worksheet: members,
    column: 'G',
    formula: (row) => `INDIRECT(IF($O${row}="","ListaVacia","Municipios_P"&$O${row}))`,
    fieldName: 'Municipio',
  });
  addValidation({
    worksheet: members,
    column: 'H',
    formula: (row) => `INDIRECT(IF($P${row}="","ListaVacia","Sectores_M"&$P${row}))`,
    fieldName: 'Sector',
  });
  addValidation({
    worksheet: members,
    column: 'J',
    formula: 'ListaDestacamentos',
    fieldName: 'Destacamento',
  });
  addValidation({
    worksheet: members,
    column: 'K',
    formula: 'ListaPosicionesDestacamento',
    fieldName: 'Posición_Destacamento',
  });
  addValidation({
    worksheet: members,
    column: 'L',
    formula: 'ListaPosicionesNacionales',
    fieldName: 'Posición_Nacional',
  });
  addValidation({
    worksheet: members,
    column: 'M',
    formula: 'ListaTallas',
    fieldName: 'Size_T-Shirt',
  });
  addValidation({
    worksheet: members,
    column: 'N',
    formula: 'ListaSexos',
    fieldName: 'Sexo',
  });

  return workbook.xlsx.writeBuffer();
};
