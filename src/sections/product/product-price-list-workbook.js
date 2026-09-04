// ----------------------------------------------------------------------
// LA LISTA DE PRECIOS EN EXCEL, CON LA MISMA CARA QUE EL PDF.
//
// La descarga en Excel salia como una tabla pelada: cuatro encabezados y los
// datos debajo, sin membrete, sin anchos y con los precios como numeros sueltos.
// El mismo archivo que se imprime en PDF —y que la Oficina Nacional reparte—
// tiene que reconocerse al abrirlo en la hoja de calculo.
//
// Se arma con ExcelJS, que es lo que ya usa la plantilla de miembros: `xlsx`, el
// otro paquete del proyecto, escribe los datos pero no los colores (el estilo es
// de su version de pago). Se carga a demanda, para no meter la libreria entera
// en el paquete de la pantalla.
//
// Los colores son los del documento oficial, en ARGB como los pide ExcelJS.
// ----------------------------------------------------------------------

const COLORES = {
  azulTitulo: 'FF16365C',
  rojoCabecera: 'FF963634',
  rosaCabecera: 'FFDA9694',
  rosaRestringido: 'FFF2DCDB',
  beigeAlterno: 'FFEAE7DA',
  blanco: 'FFFFFFFF',
};

// "$ 2,700.00". El texto —"N/A", "Pendiente"— se escribe tal cual y no se
// formatea como numero.
const FORMATO_MONEDA = '"$" #,##0.00';

const BORDE_FINO = {
  top: { style: 'thin', color: { argb: COLORES.blanco } },
  left: { style: 'thin', color: { argb: COLORES.blanco } },
  right: { style: 'thin', color: { argb: COLORES.blanco } },
  bottom: { style: 'thin', color: { argb: COLORES.blanco } },
};

const relleno = (argb) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });

const esRestringido = (row) => String(row?.renglon || '').toLowerCase() === 'restringido';

const etiquetaRenglon = (row) => (esRestringido(row) ? 'Restringido' : 'General');

// Sin precio no es un cero: o esta pendiente de fijar, o a ese publico no se le
// vende el articulo. Es el mismo criterio que el PDF y que la pantalla.
const valorPrecio = (row, campo, vacio) => {
  if (row?.precioPendiente) return 'Pendiente';

  const numero = Number(row?.[campo] || 0);

  return numero || vacio;
};

/**
 * Devuelve el Blob del .xlsx listo para descargar.
 */
export async function construirLibroListaDePrecios({
  title = 'TIENDA ERRD',
  anio = '',
  rows = [],
} = {}) {
  const { default: ExcelJS } = await import('exceljs');

  const libro = new ExcelJS.Workbook();
  libro.creator = title;
  libro.created = new Date();

  const hoja = libro.addWorksheet('Precios', {
    views: [{ state: 'frozen', ySplit: 4 }],
    pageSetup: { paperSize: 1, orientation: 'portrait', fitToPage: true, fitToWidth: 1 },
  });

  hoja.columns = [
    { key: 'renglon', width: 16 },
    { key: 'articulo', width: 62 },
    { key: 'registrado', width: 22 },
    { key: 'noRegistrado', width: 22 },
  ];

  // 1) Membrete
  hoja.mergeCells('A1:C1');
  hoja.getCell('A1').value = `${title} · Precios de insignias y artículos`;
  hoja.getCell('A1').font = { bold: true, size: 14, color: { argb: COLORES.blanco } };
  hoja.getCell('D1').value = anio;
  hoja.getCell('D1').font = { bold: true, size: 14, color: { argb: COLORES.blanco } };
  hoja.getCell('D1').alignment = { horizontal: 'right' };
  ['A1', 'B1', 'C1', 'D1'].forEach((celda) => {
    hoja.getCell(celda).fill = relleno(COLORES.azulTitulo);
  });
  hoja.getRow(1).height = 28;

  // 2) A quien pertenece cada precio
  hoja.getCell('C2').value = 'DESTACAMENTOS REGISTRADOS';
  hoja.getCell('D2').value = 'DESTACAMENTOS No Registrados';
  ['A2', 'B2', 'C2', 'D2'].forEach((celda) => {
    hoja.getCell(celda).fill = relleno(COLORES.rosaCabecera);
    hoja.getCell(celda).font = { bold: true, size: 9, color: { argb: COLORES.blanco } };
    hoja.getCell(celda).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  });
  hoja.getRow(2).height = 24;

  // 3) Encabezados
  const cabecera = hoja.getRow(3);
  cabecera.values = ['Renglón', 'Artículo', 'Precio de venta', 'Precio de venta'];
  cabecera.eachCell((celda, columna) => {
    celda.fill = relleno(COLORES.rojoCabecera);
    celda.font = { bold: true, color: { argb: COLORES.blanco } };
    celda.alignment = { horizontal: columna > 2 ? 'right' : 'left', vertical: 'middle' };
    celda.border = BORDE_FINO;
  });
  cabecera.height = 20;

  // 4) Los articulos
  rows.forEach((row, index) => {
    const fila = hoja.addRow([
      etiquetaRenglon(row),
      row?.name || '',
      valorPrecio(row, 'precioRegistrado', ''),
      valorPrecio(row, 'precioNoRegistrado', 'N/A'),
    ]);

    // Lo restringido con su propio tono; el resto alterna, para no perder la
    // fila de largo.
    const fondo = esRestringido(row)
      ? COLORES.rosaRestringido
      : index % 2
        ? COLORES.beigeAlterno
        : COLORES.blanco;

    fila.eachCell((celda, columna) => {
      celda.fill = relleno(fondo);
      celda.border = BORDE_FINO;
      celda.alignment = {
        vertical: 'middle',
        wrapText: columna === 2,
        horizontal: columna > 2 ? 'right' : 'left',
      };

      if (columna > 2 && typeof celda.value === 'number') {
        celda.numFmt = FORMATO_MONEDA;
      }
    });
  });

  // Filtro sobre los encabezados: la lista es larga y casi siempre se busca por
  // renglon o por articulo.
  hoja.autoFilter = { from: 'A3', to: `D${hoja.rowCount}` };

  const buffer = await libro.xlsx.writeBuffer();

  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}
