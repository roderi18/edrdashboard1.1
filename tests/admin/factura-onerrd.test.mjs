// LA FACTURA DE CADA CERTIFICADO ONERRD.
//
// Qué protege: cada certificado ONERRD lleva su factura con el formato de la
// Tienda ERRD (número correlativo, fecha, "Facturar a", concepto, líneas con
// precio, cantidad e importe, total y sello del estado). Los datos son los de
// un recibo (estado, vencimiento, líneas, descuento, impuestos) y se guardan
// al emitir; el diseño se edita como el del certificado. Un certificado
// emitido antes de que existiera la factura no la inventa, y las facturas de
// la primera versión (un solo precio) siguen saliendo igual.

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  cajaDeSelloFactura,
  cajaDeTablaFactura,
  sanearFacturaOnerrd,
  datosDeFacturaOnerrd,
  formatearMontoOnerrd,
  facturaDePruebaOnerrd,
  PAGINA_FACTURA_ONERRD,
  facturarAPropuestoOnerrd,
  formatearFechaLargaOnerrd,
  sanearDisenoFacturaOnerrd,
  facturaDesdeValoresOnerrd,
  anioActualOnerrd,
  venceDelRegistroOnerrd,
  idContadorFacturasOnerrd,
  formatearNumeroFacturaOnerrd,
  NUMERO_FACTURA_DE_PRUEBA_ONERRD,
  PRECIO_FACTURA_ONERRD_POR_DEFECTO,
  CAMPOS_DE_FABRICA_FACTURA_ONERRD,
  esIdImagenFacturaOnerrd,
  disenoFacturaParaGuardar,
  crearIdImagenFacturaOnerrd,
  LOGO_FACTURA_ONERRD,
  EMISOR_FACTURA_ONERRD,
  resolverDescripcionOnerrd,
  cajaDeFormaFactura,
  COLORES_FACTURA_ONERRD,
  FORMAS_DE_FABRICA_FACTURA_ONERRD,
  valoresDeFacturaOnerrd,
} from '../../src/utils/factura-onerrd.mjs';

test('"Facturar a" propone al coordinador y su destacamento, como el ejemplo', () => {
  assert.equal(
    facturarAPropuestoOnerrd({ coordinador: 'Leoncio Alberto Vásquez', numeroDestacamento: '11' }),
    'Leoncio Alberto Vásquez -Dest. 11'
  );
  assert.equal(facturarAPropuestoOnerrd({ pastor: 'Ana Ruiz' }), 'Ana Ruiz');
  assert.equal(facturarAPropuestoOnerrd({}), '');
});

test('los datos de un recibo: estado, vencimiento, líneas, descuento e impuestos', () => {
  const valores = { coordinador: 'Leoncio Alberto Vásquez', numeroDestacamento: '11', anio: 2027 };
  const vacia = sanearFacturaOnerrd({}, valores);
  assert.equal(vacia.facturarA, 'Leoncio Alberto Vásquez -Dest. 11');
  assert.equal(vacia.estado, 'pagada');
  assert.deepEqual(vacia.lineas, [
    {
      descripcion: 'Cuota Renovación de Membresía Anual 2027 ({registro})',
      cantidad: 1,
      precio: PRECIO_FACTURA_ONERRD_POR_DEFECTO,
    },
  ]);

  const escrita = facturaDesdeValoresOnerrd({
    ...valores,
    facturaA: '  Otro  nombre ',
    facturaEstado: 'pendiente',
    facturaVence: '2026-11-07T12:00:00Z',
    facturaLineas: [
      { descripcion: '', cantidad: '2', precio: '1,250.5' },
      { descripcion: 'Pañoletas', cantidad: '0', precio: '-3' },
    ],
    facturaCodigo: ' fidelidad25 ',
    facturaDescuento: '100',
    facturaImpuestos: '150',
  });
  assert.equal(escrita.facturarA, 'Otro nombre');
  assert.equal(escrita.estado, 'pendiente');
  assert.equal(escrita.vence, '2026-11-07T12:00:00.000Z');
  assert.deepEqual(escrita.lineas[0], {
    descripcion: 'Cuota Renovación de Membresía Anual 2027 ({registro})',
    cantidad: 2,
    precio: 1250.5,
  });
  // Cantidad mínima 1; un precio roto vuelve al de siempre.
  assert.deepEqual(escrita.lineas[1], { descripcion: 'Pañoletas', cantidad: 1, precio: 1500 });
  assert.equal(escrita.codigoDescuento, 'fidelidad25');
  assert.equal(escrita.descuento, 100);
  assert.equal(escrita.impuestos, 100); // tope 100 %
  assert.equal(sanearFacturaOnerrd({ estado: 'otro' }).estado, 'pagada');
  // Un contador por año, con el prefijo que las reglas suben de uno en uno.
  assert.equal(idContadorFacturasOnerrd(2026), 'contador-facturas-2026');
});

test('la factura pinta lo del ejemplo: número, fecha larga, concepto, línea y total', () => {
  const datos = datosDeFacturaOnerrd({
    numeroRegistro: '2027-009',
    anio: 2027,
    emitidoEnIso: '2026-01-30T15:00:00Z',
    // La forma de las primeras facturas emitidas: un solo precio.
    factura: {
      numero: 100,
      facturarA: 'Leoncio Alberto Vásquez -Dest. 11',
      precio: 1500,
      cantidad: 1,
      codigoDescuento: 'fidelidad25',
    },
  });
  assert.equal(datos.numero, '100');
  assert.equal(datos.fecha, '30 de enero de 2026');
  assert.equal(datos.facturarA, 'Leoncio Alberto Vásquez -Dest. 11');
  assert.equal(datos.concepto, 'Pago de cuota de Renovación de Membresía Anual 2027');
  assert.deepEqual(datos.lineas, [
    {
      descripcion: 'Cuota Renovación de Membresía Anual 2027 (2027-009)',
      detalle: '(código: fidelidad25)',
      precio: '1,500.00',
      cantidad: 1,
      importe: '1,500.00',
    },
  ]);
  assert.equal(datos.total, '1,500.00');
  assert.equal(datos.descuento, '');
  assert.equal(datos.moneda, 'RD$');
  assert.equal(datos.sello, 'PAGADO');
});

test('subtotal, descuento e impuestos como un recibo; el sello dice el estado', () => {
  const datos = datosDeFacturaOnerrd({
    anio: 2027,
    emitidoEnIso: '2026-10-07T15:00:00Z',
    factura: {
      numero: 7,
      estado: 'pendiente',
      lineas: [
        { descripcion: 'Cuota', cantidad: 2, precio: 1500 },
        { descripcion: 'Pañoletas', cantidad: 3, precio: 100 },
      ],
      descuento: 300,
      impuestos: 18,
    },
  });
  assert.equal(datos.subtotal, '3,300.00');
  assert.equal(datos.impuestos, '594.00');
  assert.equal(datos.descuento, '300.00');
  assert.equal(datos.total, '3,594.00');
  assert.equal(datos.sello, 'PENDIENTE');

  // Bajo la tabla: SUBTOTAL, DESCUENTO, IMPUESTOS y TOTAL, uno tras otro.
  const { tabla } = sanearDisenoFacturaOnerrd();
  const caja = cajaDeTablaFactura(tabla, datos);
  assert.deepEqual(
    caja.totales.map((t) => t.etiqueta),
    ['SUBTOTAL', 'DESCUENTO', 'IMPUESTOS (18%)', 'TOTAL']
  );
  // Con su hueco: el TOTAL va en su caja, separado de la tabla.
  assert.equal(caja.totales[0].top, caja.bottom + tabla.separacionTotal);
  // 8 filas (o más si hay más líneas) bajo el encabezado.
  assert.equal(caja.filas.length, 8);
  assert.ok(Math.abs(caja.columnas.reduce((s, c) => s + c.width, 0) - caja.width) < 1e-9);
});

test('un certificado emitido antes de la factura no la inventa', () => {
  assert.equal(datosDeFacturaOnerrd({ numeroRegistro: '2027-008' }), null);
  assert.equal(formatearMontoOnerrd(1234567.5), '1,234,567.50');
  // La fecha va en hora de Santo Domingo: las 2 a. m. UTC aún son el día anterior.
  assert.equal(formatearFechaLargaOnerrd('2026-10-08T02:00:00Z'), '7 de octubre de 2026');
});

test('la factura de prueba lleva el número y el sello PRUEBA', () => {
  const datos = datosDeFacturaOnerrd(
    facturaDePruebaOnerrd(
      { coordinador: 'Ana Ruiz', numeroDestacamento: '7', facturaCodigo: 'x1' },
      { anio: 2027, fecha: '2026-10-07T15:00:00Z' }
    )
  );
  assert.equal(datos.numero, NUMERO_FACTURA_DE_PRUEBA_ONERRD);
  assert.equal(datos.facturarA, 'Ana Ruiz -Dest. 7');
  assert.equal(datos.total, '1,500.00');
  assert.equal(datos.sello, 'PRUEBA');
  assert.equal(datos.lineas[0].detalle, '(código: x1)');
  assert.equal(datos.fecha, '7 de octubre de 2026');
});

test('el diseño: los textos de fábrica nunca se pierden y se editan como en el certificado', () => {
  const vacio = sanearDisenoFacturaOnerrd();
  assert.deepEqual(
    vacio.campos.map((c) => c.id),
    CAMPOS_DE_FABRICA_FACTURA_ONERRD.map((c) => c.id)
  );
  assert.ok(vacio.campos.every((c) => c.deFabrica));
  // No tropiezan con los campos de fábrica del certificado (mismo saneado).
  assert.equal(vacio.campos.find((c) => c.id === 'facturaTitulo').contenido, 'FACTURA');
  assert.equal(vacio.campos.find((c) => c.id === 'facturaTitulo').fuente, 'Roboto');

  const guardado = sanearDisenoFacturaOnerrd({
    campos: [{ id: 'facturaTitulo', tamano: 30, rotacion: 370, color: '#ff0000' }],
    sello: { rotacion: -15, ancho: 500, colorTexto: 'azul' },
    tabla: { filas: 99, titulos: { total: 'TOTAL A PAGAR' } },
  });
  const titulo = guardado.campos.find((c) => c.id === 'facturaTitulo');
  assert.equal(titulo.tamano, 30);
  assert.equal(titulo.rotacion, 10);
  assert.equal(titulo.color, '#FF0000');
  assert.equal(titulo.contenido, 'FACTURA'); // lo no guardado, el de fábrica
  assert.equal(guardado.campos.length, CAMPOS_DE_FABRICA_FACTURA_ONERRD.length);
  assert.equal(guardado.sello.ancho, 100);
  assert.equal(guardado.sello.colorTexto, COLORES_FACTURA_ONERRD.sello);
  assert.equal(guardado.tabla.filas, 20);
  assert.equal(guardado.tabla.titulos.total, 'TOTAL A PAGAR');

  // El sello: un estado más largo encoge la letra para caber en su recuadro.
  const pagado = cajaDeSelloFactura(guardado.sello, 'PAGADO', PAGINA_FACTURA_ONERRD);
  const pendiente = cajaDeSelloFactura(guardado.sello, 'PENDIENTE', PAGINA_FACTURA_ONERRD);
  assert.ok(pendiente.tamano < pagado.tamano);
});

// Imágenes subidas a la factura: el diseño guarda solo su sitio, tamaño y
// giro, y la imagen va en su propio documento (por su id). Un id raro no
// apunta a otro documento de la colección.
test('las imágenes de la factura: id propio, posición, tamaño y giro', () => {
  const id = crearIdImagenFacturaOnerrd(1791380000000);
  assert.equal(id, 'factura-imagen-1791380000000');
  assert.equal(esIdImagenFacturaOnerrd(id), true);
  assert.equal(esIdImagenFacturaOnerrd('diseno'), false);
  assert.equal(esIdImagenFacturaOnerrd('factura-imagen-../x'), false);

  const { imagenes } = sanearDisenoFacturaOnerrd({
    imagenes: [
      { id, x: 20, y: 'roto', ancho: 300, rotacion: 270 },
      { id },
      { id: 'contador-facturas', x: 1 },
    ],
  });
  assert.deepEqual(imagenes, [{ id, visible: true, x: 20, y: 50, ancho: 100, rotacion: -90 }]);
  assert.deepEqual(disenoFacturaParaGuardar({ imagenes }).imagenes, imagenes);
  assert.deepEqual(sanearDisenoFacturaOnerrd().imagenes, []);
});

// La cabecera de fábrica lleva el logo (el emblema en PNG: el PDF no lee WebP)
// y el remitente completo: dirección, RNC, correo y teléfono.
test('la cabecera: logo y remitente con RNC, correo y teléfono', () => {
  assert.equal(LOGO_FACTURA_ONERRD.src, '/marca/watermark.png');
  const { campos, logo } = sanearDisenoFacturaOnerrd();
  assert.equal(logo.visible, true);
  const texto = (id) => campos.find((c) => c.id === id)?.contenido;
  assert.equal(texto('facturaRnc'), 'RNC: 4-30-29726-7');
  assert.equal(texto('facturaCorreo'), 'Correo electrónico: oficinanacional@errd.org.do');
  assert.equal(texto('facturaTelefonos'), 'Número telefónico: 809-000-0000');
  assert.equal(texto('facturaDireccion'), EMISOR_FACTURA_ONERRD.direccion);
  // El remitente va a la derecha del logo, sin pisarlo.
  const ladoDerechoLogo = logo.x + logo.ancho / 2;
  const izquierdaRemitente = (c) => c.x - c.ancho / 2;
  ['facturaEmisor', 'facturaRnc', 'facturaCorreo'].forEach((id) => {
    assert.ok(izquierdaRemitente(campos.find((c) => c.id === id)) > ladoDerechoLogo, id);
  });
  // Un diseño guardado antes del logo lo recibe en su sitio de fábrica.
  assert.deepEqual(sanearDisenoFacturaOnerrd({ campos: [] }).logo, logo);
});

// La descripción se escribe a mano y puede llevar {registro}: la factura pone
// el número de registro del certificado, "(2027-015)". La de siempre ya lo
// lleva al final. Sin número, los paréntesis vacíos no salen.
test('la descripción lleva el número de registro con la variable {registro}', () => {
  assert.equal(
    resolverDescripcionOnerrd('Cuota Renovación de Membresía Anual 2027 ({registro})', '2027-015'),
    'Cuota Renovación de Membresía Anual 2027 (2027-015)'
  );
  assert.equal(resolverDescripcionOnerrd('Pañoletas ({registro})', ''), 'Pañoletas');
  assert.equal(resolverDescripcionOnerrd('Sin variable', '2027-015'), 'Sin variable');
  const datos = datosDeFacturaOnerrd({
    numeroRegistro: '2027-015',
    anio: 2027,
    emitidoEnIso: '2026-10-07T15:00:00Z',
    factura: {
      numero: 3,
      lineas: [
        { descripcion: '', cantidad: 1, precio: 1500 },
        { descripcion: 'Pañoletas del {registro}', cantidad: 2, precio: 100 },
      ],
    },
  });
  assert.equal(datos.lineas[0].descripcion, 'Cuota Renovación de Membresía Anual 2027 (2027-015)');
  assert.equal(datos.lineas[1].descripcion, 'Pañoletas del 2027-015');
});

// El diseño de fábrica con los colores de la casa: barras y rayas (formas),
// "FACTURAR A" en su barra navy, la tabla con el encabezado relleno y el
// TOTAL en su caja, el sello azul y el pie. Todo editable. Lo que se rompía
// si no: una factura ya emitida (su diseño guardado no trae estas claves)
// cambiaba de aspecto al volver a bajarla, o le salía de pronto el pie.
test('el diseño de fábrica nuevo, sin cambiar las facturas ya emitidas', () => {
  const fabrica = sanearDisenoFacturaOnerrd();
  const { navy, oro } = COLORES_FACTURA_ONERRD;

  // Las formas de fábrica, con su raya dorada de la cabecera de 1,6 pt.
  assert.deepEqual(
    fabrica.formas.map((f) => f.id),
    FORMAS_DE_FABRICA_FACTURA_ONERRD.map((f) => f.id)
  );
  const divisor = fabrica.formas.find((f) => f.id === 'divisorCabecera');
  assert.equal(divisor.relleno, oro);
  assert.ok(Math.abs(cajaDeFormaFactura(divisor).width - 1.6) < 0.05);
  const barra = fabrica.formas.find((f) => f.id === 'barraFacturarA');
  assert.equal(barra.relleno, navy);
  assert.equal(barra.esquinas, 'arriba');
  // El recuadro, sin relleno ('' se conserva, no vuelve a navy).
  assert.equal(fabrica.formas.find((f) => f.id === 'recuadroFacturarA').relleno, '');

  // "FACTURAR A:" en blanco sobre la barra; el nombre ya no lleva el rótulo.
  const campo = (id) => fabrica.campos.find((c) => c.id === id);
  assert.equal(campo('facturaAEtiqueta').color, '#FFFFFF');
  assert.equal(campo('facturaA').prefijo, '');
  assert.equal(campo('facturaPie').contenido, 'EXPLORADORES DEL REY REPÚBLICA DOMINICANA');
  assert.equal(fabrica.tabla.colorEncabezado, navy);
  assert.equal(fabrica.linea.visible, false);

  // Con encabezado relleno, el rótulo del TOTAL va bajo CANTIDAD y el valor
  // bajo IMPORTE; con desglose, el rótulo ocupa también PRECIO.
  const datos = datosDeFacturaOnerrd(facturaDePruebaOnerrd({}, { anio: 2027 }));
  const caja = cajaDeTablaFactura(fabrica.tabla, datos);
  assert.equal(caja.etiquetaTotales.left, caja.columnas[2].left);
  assert.ok(
    Math.abs(caja.marcoTotales.left + caja.marcoTotales.width - (caja.left + caja.width)) < 1e-9
  );

  // Un diseño guardado antes (como la copia de una factura emitida): sin
  // formas, tabla y sello como eran, y los textos nuevos ocultos.
  const antiguo = sanearDisenoFacturaOnerrd({
    campos: [{ id: 'facturaA', prefijo: 'FACTURAR A: ' }],
    tabla: { colorBorde: '#000000' },
    sello: { colorTexto: '#29ABE2' },
    linea: { visible: true, x: 34.48, y: 19.82, ancho: 50, grosor: 1, color: '#000000' },
  });
  assert.deepEqual(antiguo.formas, []);
  assert.equal(antiguo.tabla.colorEncabezado, '');
  assert.equal(antiguo.tabla.radio, 0);
  assert.equal(antiguo.tabla.separacionTotal, 0);
  assert.equal(antiguo.sello.radio, 0);
  assert.equal(antiguo.linea.visible, true);
  assert.equal(antiguo.campos.find((c) => c.id === 'facturaA').prefijo, 'FACTURAR A: ');
  assert.equal(antiguo.campos.find((c) => c.id === 'facturaPie').visible, false);
  assert.equal(antiguo.campos.find((c) => c.id === 'facturaAEtiqueta').visible, false);

  // Lo guardado con formas vuelve igual (lo que se guarda las incluye).
  assert.deepEqual(
    sanearDisenoFacturaOnerrd(disenoFacturaParaGuardar(fabrica)).formas,
    fabrica.formas
  );
});

// El número de factura: ONERRD-AAAA-NNN, como el del certificado (AAAA-NNN),
// con el año en que se emite (hora de Santo Domingo) y su correlativo, que
// vuelve a 001 cada año. El precio lleva la coma de los miles, como el importe.
test('el número de factura es ONERRD-año-NNN y el precio lleva la coma de los miles', () => {
  assert.equal(formatearNumeroFacturaOnerrd(2026, 2), 'ONERRD-2026-002');
  assert.equal(formatearNumeroFacturaOnerrd(2026, 1234), 'ONERRD-2026-1234');
  // El 31 de diciembre a las 9 p. m. en Santo Domingo ya es 1 de enero en UTC.
  assert.equal(anioActualOnerrd(new Date('2027-01-01T01:00:00Z')), 2026);
  assert.equal(anioActualOnerrd(new Date('2026-10-07T15:00:00Z')), 2026);

  const datos = datosDeFacturaOnerrd({
    anio: 2027,
    emitidoEnIso: '2026-10-07T15:00:00Z',
    factura: { numero: 'ONERRD-2026-002', lineas: [{ cantidad: 1, precio: 1500 }] },
  });
  assert.equal(datos.numero, 'ONERRD-2026-002');
  assert.equal(datos.lineas[0].precio, '1,500.00');
  assert.equal(datos.lineas[0].importe, '1,500.00');
});

// EL VENCIMIENTO: cada 1 de octubre abre un período que vence el 31 de
// diciembre del año siguiente; cuenta la fecha del registro. De enero a
// septiembre es el período que abrió el octubre anterior.
test('el registro vence el 31 dic. del año siguiente a la apertura del 1 oct.', () => {
  const vence = (fecha) => formatearFechaLargaOnerrd(venceDelRegistroOnerrd(fecha));
  assert.equal(vence('2026-10-07T16:00:00Z'), '31 de diciembre de 2027');
  assert.equal(vence('2026-10-01T16:00:00Z'), '31 de diciembre de 2027');
  assert.equal(vence('2027-03-15T16:00:00Z'), '31 de diciembre de 2027');
  assert.equal(vence('2027-09-30T16:00:00Z'), '31 de diciembre de 2027');
  assert.equal(vence('2027-10-15T16:00:00Z'), '31 de diciembre de 2028');
  // 04:30 UTC del 1 oct. son las 12:30 a. m. del 1 oct. en Santo Domingo.
  assert.equal(vence('2026-10-01T04:30:00Z'), '31 de diciembre de 2027');
  // 03:30 UTC del 1 oct. aún son las 11:30 p. m. del 30 sep. en Santo Domingo.
  assert.equal(vence('2026-10-01T03:30:00Z'), '31 de diciembre de 2026');
  assert.equal(venceDelRegistroOnerrd(''), '');

  // Sin "Vence" escrito, la factura lleva el del registro; escrito a mano, manda.
  const conRegistro = facturaDesdeValoresOnerrd({ anio: 2027, fecha: '2026-10-07T16:00:00Z' });
  assert.equal(formatearFechaLargaOnerrd(conRegistro.vence), '31 de diciembre de 2027');
  const aMano = facturaDesdeValoresOnerrd({
    anio: 2027,
    fecha: '2026-10-07T16:00:00Z',
    facturaVence: '2027-06-30T16:00:00Z',
  });
  assert.equal(formatearFechaLargaOnerrd(aMano.vence), '30 de junio de 2027');
});

// "VENCE:" va aparte, como "FECHA:" (mismo estilo y alineación), y la fecha
// sola a la derecha; los dos se mueven a gusto. Sin vencimiento, no sale el
// rótulo suelto.
test('el vencimiento: rótulo aparte como FECHA y la fecha sola', () => {
  const { campos } = sanearDisenoFacturaOnerrd();
  const campo = (id) => campos.find((c) => c.id === id);
  const rotulo = campo('facturaVenceEtiqueta');
  const fechaRotulo = campo('facturaFechaEtiqueta');
  assert.deepEqual(
    [rotulo.fuente, rotulo.peso, rotulo.color, rotulo.tamano, rotulo.alineacion, rotulo.x],
    [
      fechaRotulo.fuente,
      fechaRotulo.peso,
      fechaRotulo.color,
      fechaRotulo.tamano,
      fechaRotulo.alineacion,
      fechaRotulo.x,
    ]
  );
  assert.equal(campo('facturaVence').alineacion, campo('facturaFecha').alineacion);
  assert.equal(campo('facturaVence').x, campo('facturaFecha').x);

  const con = valoresDeFacturaOnerrd({ vence: '31 de diciembre de 2027' });
  assert.equal(con.facturaVenceEtiqueta, 'VENCE:');
  assert.equal(con.facturaVence, '31 de diciembre de 2027');
  const sin = valoresDeFacturaOnerrd({ vence: '' });
  assert.equal(sin.facturaVenceEtiqueta, '');
  assert.equal(sin.facturaVence, '');
});
