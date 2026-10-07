import {
  FUENTES_ONERRD,
  acotarPosicion,
  sanearCampoOnerrd,
  acotarRotacionOnerrd,
} from './certificado-onerrd.mjs';

// ----------------------------------------------------------------------
// LA FACTURA DE CADA CERTIFICADO ONERRD: la cuota de renovación anual que
// paga el destacamento, con el formato de la factura de la Tienda ERRD que
// se hacía a mano ("Ejemplo factura 30012026_onerrd_dest11.pdf").
//
// Dos partes, como el certificado:
// - Los DATOS de cada factura (como un recibo de /dashboard/invoice: a quién,
//   estado, vencimiento, líneas, descuento e impuestos) se escriben en
//   "Datos del registro" y se guardan con la emisión (`emitido.factura`).
// - El DISEÑO (dónde va cada texto, su letra, tamaño, color, giro…; la tabla
//   y el sello) se edita en "Diseño de la factura" y se guarda en
//   `certificadosOnerrd/diseno-factura`. Cada emisión lleva una copia
//   (`emitido.disenoFactura`): volver a bajarla no cambia con el diseño nuevo.
//
// Los textos son campos del certificado ONERRD (`sanearCampoOnerrd`): el
// mismo lienzo, las mismas opciones y el mismo PDF. La tabla, el sello, las
// formas (barras, rayas y recuadros) y la raya son de la factura.
//
// El número es correlativo y único para todas las facturas (`contador-
// facturas`), reservado en la misma transacción que el certificado. El PDF se
// genera al descargarlo. Sin navegador ni Firebase: lo prueba
// `tests/admin/factura-onerrd.test.mjs`.
// ----------------------------------------------------------------------

// El remitente: Oficina Nacional de Exploradores del Rey.
export const EMISOR_FACTURA_ONERRD = Object.freeze({
  nombre: 'ERRD',
  subtitulo: 'Tienda',
  direccion: 'Aut. Duarte km 13 1/2, Santo Domingo Oeste',
  rnc: 'RNC: 4-30-29726-7',
  correo: 'Correo electrónico: oficinanacional@errd.org.do',
  telefono: 'Número telefónico: 809-000-0000',
});

// El logo de la cabecera: el emblema en PNG (el PDF no lee WebP), cuadrado.
export const LOGO_FACTURA_ONERRD = Object.freeze({
  src: '/marca/watermark.png',
  proporcion: 1,
});

export const PRECIO_FACTURA_ONERRD_POR_DEFECTO = 1500;

// Pesos dominicanos: "RD$ 1,500.00" (el ejemplo ponía solo "$").
export const MONEDA_FACTURA_ONERRD = 'RD$';

// El número que lleva la factura de prueba: nunca uno del contador.
export const NUMERO_FACTURA_DE_PRUEBA_ONERRD = 'PRUEBA';

// Mismo prefijo que los contadores por año: `firestore.rules` ya lo deja
// subir solo de uno en uno.
export const ID_CONTADOR_FACTURAS_ONERRD = 'contador-facturas';

export const ID_DISENO_FACTURA_ONERRD = 'diseno-factura';

// Carta vertical, en puntos.
export const PAGINA_FACTURA_ONERRD = Object.freeze({ ancho: 612, alto: 792 });

// Los estados de un recibo (/dashboard/invoice) y lo que dice su sello.
export const ESTADOS_FACTURA_ONERRD = Object.freeze([
  Object.freeze({ value: 'pagada', label: 'Pagada', sello: 'PAGADO' }),
  Object.freeze({ value: 'pendiente', label: 'Pendiente', sello: 'PENDIENTE' }),
  Object.freeze({ value: 'vencida', label: 'Vencida', sello: 'VENCIDA' }),
  Object.freeze({ value: 'borrador', label: 'Borrador', sello: 'BORRADOR' }),
]);

const ZONA_HORARIA = 'America/Santo_Domingo';

const texto = (valor, maximo) =>
  String(valor ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maximo);

const numero = (valor, porDefecto) => {
  if (valor === null || valor === '' || valor === undefined) return porDefecto;
  const n = Number(String(valor).replace(/,/g, ''));
  return Number.isFinite(n) ? n : porDefecto;
};

const acotar = (valor, minimo, maximo) => Math.min(maximo, Math.max(minimo, valor));

const redondear = (valor) => Math.round(valor * 100) / 100;

const colorHex = (valor, porDefecto) =>
  /^#[0-9a-f]{6}$/i.test(String(valor || '')) ? String(valor).toUpperCase() : porDefecto;

// Un color o nada ('' = sin relleno / sin borde).
const colorOVacio = (valor, porDefecto) => (valor === '' ? '' : colorHex(valor, porDefecto));

// Los colores de la casa (`src/theme`): el navy del escudo, el oro
// institucional, el azul cielo del sello y el celeste del azul institucional
// (`primary.lighter`); la franja es ese celeste a medias con el blanco. Antes
// la factura iba en gris y negro, copiada de la que se hacía a mano.
export const COLORES_FACTURA_ONERRD = Object.freeze({
  navy: '#122A4F',
  oro: '#C9A227',
  sello: '#1C74D4',
  celeste: '#DDE7F6',
  franja: '#EEF3FB',
  texto: '#1C252E',
  blanco: '#FFFFFF',
});

const { navy: NAVY, oro: ORO, texto: TEXTO, blanco: BLANCO } = COLORES_FACTURA_ONERRD;

const fuenteValida = (valor, porDefecto = 'Helvetica') =>
  FUENTES_ONERRD.some((item) => item.value === valor) ? valor : porDefecto;

// ---------------------------------------------------------------- datos de cada factura

// "Leoncio Alberto Vásquez -Dest. 11", como en la factura de ejemplo: el
// coordinador (o, sin él, el pastor) y el número del destacamento.
export const facturarAPropuestoOnerrd = (valores = {}) => {
  const nombre = texto(valores.coordinador, 120) || texto(valores.pastor, 120);
  const destacamento = texto(valores.numeroDestacamento, 20);
  return [nombre, destacamento && `-Dest. ${destacamento}`].filter(Boolean).join(' ');
};

// La variable del número de registro en la descripción de una línea: se
// escribe {registro} y la factura pone el del certificado ("(2027-015)").
export const VARIABLE_REGISTRO_FACTURA = '{registro}';

export const descripcionPropuestaOnerrd = (anio) =>
  `Cuota Renovación de Membresía Anual ${anio || ''} (${VARIABLE_REGISTRO_FACTURA})`
    .replace(/\s+/g, ' ')
    .trim();

// {registro} → el número; sin número, la variable (y sus paréntesis vacíos) se va.
export const resolverDescripcionOnerrd = (descripcion, numeroRegistro) =>
  String(descripcion || '')
    .split(VARIABLE_REGISTRO_FACTURA)
    .join(numeroRegistro || '')
    .replace(/\s*\(\s*\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();

export const LINEA_FACTURA_INICIAL = Object.freeze({
  descripcion: '',
  cantidad: '1',
  precio: String(PRECIO_FACTURA_ONERRD_POR_DEFECTO),
});

const sanearLinea = (linea = {}, anio) => {
  const precio = numero(linea.precio, PRECIO_FACTURA_ONERRD_POR_DEFECTO);
  return {
    descripcion: texto(linea.descripcion, 160) || descripcionPropuestaOnerrd(anio),
    cantidad: Math.max(1, Math.round(numero(linea.cantidad, 1))),
    // Un precio roto o negativo vuelve al de siempre (no se emite una
    // factura de 0 por descuido).
    precio: precio > 0 ? redondear(precio) : PRECIO_FACTURA_ONERRD_POR_DEFECTO,
  };
};

// Lo que se guarda con la emisión. Acepta también la forma de antes (un solo
// `precio`), la de las primeras facturas emitidas.
export const sanearFacturaOnerrd = (entrada = {}, valores = {}) => {
  const anio = valores.anio || '';
  const lineas =
    Array.isArray(entrada.lineas) && entrada.lineas.length
      ? entrada.lineas
      : [{ precio: entrada.precio, cantidad: entrada.cantidad }];
  const vence = new Date(entrada.vence || '');
  return {
    facturarA: texto(entrada.facturarA, 160) || facturarAPropuestoOnerrd(valores),
    estado: ESTADOS_FACTURA_ONERRD.some((e) => e.value === entrada.estado)
      ? entrada.estado
      : 'pagada',
    vence: Number.isNaN(vence.getTime()) ? '' : vence.toISOString(),
    lineas: lineas.slice(0, 20).map((linea) => sanearLinea(linea, anio)),
    codigoDescuento: texto(entrada.codigoDescuento, 40),
    // El concepto escrito en la factura ('' = el de siempre, con el año).
    concepto: texto(entrada.concepto, 200),
    descuento: redondear(Math.max(0, numero(entrada.descuento, 0))),
    impuestos: redondear(acotar(numero(entrada.impuestos, 0), 0, 100)),
  };
};

// Lo escrito en "Datos del registro" → lo que pide `sanearFacturaOnerrd`.
export const facturaDesdeValoresOnerrd = (valores = {}) =>
  sanearFacturaOnerrd(
    {
      facturarA: valores.facturaA,
      estado: valores.facturaEstado,
      vence: valores.facturaVence,
      lineas: valores.facturaLineas,
      codigoDescuento: valores.facturaCodigo,
      concepto: valores.facturaConcepto,
      descuento: valores.facturaDescuento,
      impuestos: valores.facturaImpuestos,
    },
    valores
  );

// 1500 → "1,500.00" (como el ejemplo).
export const formatearMontoOnerrd = (valor) =>
  (Number(valor) || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

// "30 de enero de 2026", en hora de Santo Domingo.
export const formatearFechaLargaOnerrd = (valor) => {
  const fecha = valor instanceof Date ? valor : new Date(valor);
  if (Number.isNaN(fecha.getTime())) return '';
  return new Intl.DateTimeFormat('es-DO', {
    timeZone: ZONA_HORARIA,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(fecha);
};

// Todo lo que pinta la factura. Sin factura guardada (los emitidos antes de
// que existiera), null: no se inventa un número ni un precio.
export const datosDeFacturaOnerrd = (emitido = {}) => {
  const guardada = emitido?.factura;
  if (!guardada?.numero) return null;

  const anio = emitido.anio || emitido.valores?.anio || '';
  const factura = sanearFacturaOnerrd(guardada, { ...emitido.valores, anio });
  const subtotal = factura.lineas.reduce((suma, l) => suma + l.precio * l.cantidad, 0);
  const impuestos = redondear((subtotal * factura.impuestos) / 100);
  const total = Math.max(0, redondear(subtotal + impuestos - factura.descuento));
  const prueba = guardada.numero === NUMERO_FACTURA_DE_PRUEBA_ONERRD;

  return {
    emisor: EMISOR_FACTURA_ONERRD,
    numero: String(guardada.numero),
    fecha: formatearFechaLargaOnerrd(emitido.emitidoEnIso),
    vence: factura.vence ? formatearFechaLargaOnerrd(factura.vence) : '',
    facturarA: factura.facturarA,
    concepto: factura.concepto || `Pago de cuota de Renovación de Membresía Anual ${anio}`.trim(),
    estado: factura.estado,
    lineas: factura.lineas.map((linea, indice) => ({
      descripcion: resolverDescripcionOnerrd(linea.descripcion, emitido.numeroRegistro),
      // El código de descuento va bajo la primera línea, como en el ejemplo.
      detalle:
        indice === 0 && factura.codigoDescuento ? `(código: ${factura.codigoDescuento})` : '',
      precio: linea.precio.toFixed(2),
      cantidad: linea.cantidad,
      importe: formatearMontoOnerrd(linea.precio * linea.cantidad),
    })),
    subtotal: formatearMontoOnerrd(subtotal),
    descuento: factura.descuento ? formatearMontoOnerrd(factura.descuento) : '',
    impuestos: factura.impuestos ? formatearMontoOnerrd(impuestos) : '',
    porcentajeImpuestos: factura.impuestos,
    total: formatearMontoOnerrd(total),
    moneda: MONEDA_FACTURA_ONERRD,
    // La de prueba lleva el sello PRUEBA: no puede pasar por una pagada.
    sello: prueba
      ? 'PRUEBA'
      : ESTADOS_FACTURA_ONERRD.find((e) => e.value === factura.estado)?.sello || 'PAGADO',
  };
};

// Lo que leen los textos del diseño (cada campo, por su id).
export const valoresDeFacturaOnerrd = (datos, extra = {}) => ({
  ...extra,
  facturaNumero: datos?.numero || '',
  facturaFecha: datos?.fecha || '',
  facturaA: datos?.facturarA || '',
  facturaConcepto: datos?.concepto || '',
  facturaVence: datos?.vence ? `VENCE: ${datos.vence}` : '',
});

export const nombreDeArchivoFacturaOnerrd = (emitido = {}) =>
  `factura-${emitido?.factura?.numero || ''}-onerrd-${emitido?.numeroRegistro || ''}.pdf`;

// Una "emisión" para pintar la factura sin emitir: la vista previa ('—' de
// número: el de verdad lo da la emisión) y el PDF de prueba (PRUEBA).
export const facturaSinEmitirOnerrd = (
  valores = {},
  { anio, fecha = new Date(), numero: numeroFactura = '—', numeroRegistro = '' } = {}
) => ({
  // El que llevará el certificado (el próximo): lo usa {registro}.
  numeroRegistro: numeroRegistro || NUMERO_FACTURA_DE_PRUEBA_ONERRD,
  anio,
  valores,
  emitidoEnIso: (fecha instanceof Date ? fecha : new Date(fecha)).toISOString(),
  factura: { ...facturaDesdeValoresOnerrd({ ...valores, anio }), numero: numeroFactura },
});

export const facturaDePruebaOnerrd = (valores = {}, { anio, fecha, numeroRegistro } = {}) =>
  facturaSinEmitirOnerrd(valores, {
    anio,
    fecha,
    numeroRegistro,
    numero: NUMERO_FACTURA_DE_PRUEBA_ONERRD,
  });

// ---------------------------------------------------------------- diseño

// De una caja en puntos (izquierda, centro de la línea, ancho) a % de la
// página, que es como guarda sus posiciones un campo.
const enCaja = (izquierda, y, ancho) => ({
  x: redondear(((izquierda + ancho / 2) / PAGINA_FACTURA_ONERRD.ancho) * 100),
  y: redondear((y / PAGINA_FACTURA_ONERRD.alto) * 100),
  ancho: redondear((ancho / PAGINA_FACTURA_ONERRD.ancho) * 100),
});

const textoFijo = (id, etiqueta, contenido, estilo) => ({
  id,
  tipo: 'fijo',
  etiqueta,
  contenido,
  ...estilo,
});

const textoDato = (id, etiqueta, estilo) => ({ id, tipo: 'texto', etiqueta, ...estilo });

const LETRA = (tamano, peso = 400, extra = {}) => ({
  fuente: 'Roboto',
  peso,
  negrita: peso >= 600,
  tamano,
  color: TEXTO,
  alineacion: 'left',
  mayusculas: false,
  espaciado: 0,
  ...extra,
});

// La factura, medida en puntos sobre la carta (márgenes de 32 pt). Cabecera:
// el logo a la izquierda y, a su lado, el remitente (ERRD, Tienda, dirección,
// teléfonos, correo y RNC); una raya dorada vertical y, a la derecha, FACTURA
// subrayada en oro con la fecha, el número y el vencimiento. Luego "FACTURAR
// A" en su barra navy con el recuadro debajo, el concepto, la tabla, el sello
// y el pie con el nombre de la organización. Las barras, rayas y recuadros
// son formas (`FORMAS_DE_FABRICA_FACTURA_ONERRD`).
const REMITENTE = 144; // donde empieza el texto, a la derecha del logo
const DATOS = 400; // la columna de FECHA / N.º / VENCE
const DERECHA = 580; // el margen derecho

export const CAMPOS_DE_FABRICA_FACTURA_ONERRD = Object.freeze(
  [
    textoFijo('facturaEmisor', 'Emisor', EMISOR_FACTURA_ONERRD.nombre, {
      ...LETRA(28, 700, { color: NAVY }),
      ...enCaja(REMITENTE, 49, 210),
    }),
    textoFijo('facturaTienda', 'Subtítulo del emisor', EMISOR_FACTURA_ONERRD.subtitulo, {
      // Roboto no trae cursiva: la de "Tienda" es la de Helvetica.
      ...LETRA(16, 700, { fuente: 'Helvetica', cursiva: true, color: ORO }),
      ...enCaja(REMITENTE, 71, 210),
    }),
    textoFijo('facturaDireccion', 'Dirección', EMISOR_FACTURA_ONERRD.direccion, {
      ...LETRA(9),
      ...enCaja(REMITENTE, 91, 220),
    }),
    textoFijo('facturaTelefonos', 'Número telefónico', EMISOR_FACTURA_ONERRD.telefono, {
      ...LETRA(9),
      ...enCaja(REMITENTE, 104, 220),
    }),
    textoFijo('facturaCorreo', 'Correo electrónico', EMISOR_FACTURA_ONERRD.correo, {
      ...LETRA(9),
      ...enCaja(REMITENTE, 117.5, 220),
    }),
    textoFijo('facturaRnc', 'RNC', EMISOR_FACTURA_ONERRD.rnc, {
      ...LETRA(9),
      ...enCaja(REMITENTE, 130.5, 220),
    }),
    textoFijo('facturaTitulo', 'Título', 'FACTURA', {
      ...LETRA(37, 700, { color: NAVY, espaciado: 0.5 }),
      ...enCaja(DATOS - 1, 61.5, DERECHA - DATOS + 1),
    }),
    textoFijo('facturaFechaEtiqueta', 'Rótulo de la fecha', 'FECHA:', {
      ...LETRA(10, 700, { color: NAVY }),
      ...enCaja(DATOS, 106, 90),
    }),
    textoDato('facturaFecha', 'Fecha', {
      ...LETRA(10, 400, { alineacion: 'right' }),
      ...enCaja(DATOS + 70, 106, DERECHA - DATOS - 70),
    }),
    textoFijo('facturaNumeroEtiqueta', 'Rótulo del número', 'N.º DE FACTURA:', {
      ...LETRA(10, 700, { color: NAVY }),
      ...enCaja(DATOS, 124, 100),
    }),
    textoDato('facturaNumero', 'Número de factura', {
      ...LETRA(10, 400, { alineacion: 'right' }),
      ...enCaja(DATOS + 90, 124, DERECHA - DATOS - 90),
    }),
    textoDato('facturaVence', 'Vencimiento', {
      ...LETRA(9, 400, { alineacion: 'right' }),
      ...enCaja(DATOS, 140, DERECHA - DATOS),
    }),
    // El rótulo va en blanco sobre la barra navy (una forma) y el nombre en el
    // recuadro de debajo: antes era un solo texto con "FACTURAR A: " delante.
    textoFijo('facturaAEtiqueta', 'Rótulo de «Facturar a»', 'FACTURAR A:', {
      ...LETRA(11, 700, { color: BLANCO }),
      ...enCaja(43, 166, 200),
    }),
    textoDato('facturaA', 'Facturar a', {
      ...LETRA(10.5),
      prefijo: '',
      ...enCaja(43, 193, DERECHA - 43 - 11),
    }),
    textoFijo('facturaConceptoEtiqueta', 'Rótulo del concepto', 'Concepto:', {
      ...LETRA(11.5, 700, { color: NAVY }),
      ...enCaja(34, 233, 64),
    }),
    textoDato('facturaConcepto', 'Concepto', { ...LETRA(10.5), ...enCaja(101, 233, 470) }),
    textoFijo('facturaPie', 'Pie', 'EXPLORADORES DEL REY REPÚBLICA DOMINICANA', {
      ...LETRA(9.5, 400, { color: NAVY, alineacion: 'center', espaciado: 2.5 }),
      ...enCaja(160, 760, 292),
    }),
  ].map((campo) => Object.freeze(campo))
);

const IDS_DE_FABRICA = new Set(CAMPOS_DE_FABRICA_FACTURA_ONERRD.map((campo) => campo.id));

// La tabla: x = su centro, y = su BORDE DE ARRIBA (crece hacia abajo con las
// líneas). Columnas como el ejemplo: descripción, precio, cantidad, importe.
export const COLUMNAS_TABLA_FACTURA = Object.freeze([0.49, 0.15, 0.14, 0.22]);

export const TABLA_DE_FABRICA_FACTURA_ONERRD = Object.freeze({
  visible: true,
  x: 50,
  y: redondear((256 / PAGINA_FACTURA_ONERRD.alto) * 100),
  ancho: redondear((548 / PAGINA_FACTURA_ONERRD.ancho) * 100),
  filas: 8,
  altoFila: 25.5,
  fuente: 'Roboto',
  tamano: 10,
  colorTexto: TEXTO,
  colorBorde: NAVY,
  grosorBorde: 1.2,
  colorFranja: COLORES_FACTURA_ONERRD.franja,
  colorImporte: COLORES_FACTURA_ONERRD.celeste,
  colorTotal: NAVY,
  // El encabezado relleno (navy con letras blancas), las esquinas redondeadas
  // y el TOTAL en su propia caja, separado de la tabla. Vacío / 0 = la tabla
  // de antes, sin relleno: así la pintan los diseños guardados sin estas
  // claves (las facturas ya emitidas no cambian al volver a bajarlas).
  colorEncabezado: NAVY,
  colorTextoEncabezado: BLANCO,
  radio: 5,
  separacionTotal: 6,
  titulos: Object.freeze({
    descripcion: 'DESCRIPCIÓN',
    precio: 'PRECIO UD',
    cantidad: 'CANTIDAD',
    importe: 'IMPORTE',
    total: 'TOTAL',
  }),
});

// Lo que toman las claves nuevas de la tabla en un diseño guardado sin ellas.
const TABLA_ANTIGUA = Object.freeze({
  colorEncabezado: '',
  colorTextoEncabezado: '',
  radio: 0,
  separacionTotal: 0,
});

// El sello del estado (PAGADO…): x, y = su centro; ancho = el de su recuadro.
export const SELLO_DE_FABRICA_FACTURA_ONERRD = Object.freeze({
  visible: true,
  x: 50,
  y: 75.4,
  ancho: 36,
  rotacion: -12,
  fuente: 'Roboto',
  colorTexto: COLORES_FACTURA_ONERRD.sello,
  colorBorde: COLORES_FACTURA_ONERRD.sello,
  grosorBorde: 3,
  // Esquinas redondeadas (pt). Un sello guardado sin la clave, recto.
  radio: 6,
});

// El logo de la cabecera: x, y = su centro; 94 pt de ancho, arriba a la izquierda.
export const LOGO_DE_FABRICA_FACTURA_ONERRD = Object.freeze({
  visible: true,
  x: redondear(((34 + 47) / PAGINA_FACTURA_ONERRD.ancho) * 100),
  y: redondear((78 / PAGINA_FACTURA_ONERRD.alto) * 100),
  ancho: redondear((94 / PAGINA_FACTURA_ONERRD.ancho) * 100),
  rotacion: 0,
});

// La raya bajo "FACTURAR A" (la de la primera factura): x, y = su centro.
// Desde que "Facturar a" va en su recuadro, la de fábrica sale oculta; un
// diseño guardado la conserva como la tenía.
export const LINEA_DE_FABRICA_FACTURA_ONERRD = Object.freeze({
  visible: false,
  x: redondear(((58 + 153) / PAGINA_FACTURA_ONERRD.ancho) * 100),
  y: redondear((157 / PAGINA_FACTURA_ONERRD.alto) * 100),
  ancho: 50,
  grosor: 1,
  color: '#000000',
});

// IMÁGENES SUBIDAS A LA FACTURA (un logo, un sello escaneado…). Cada una vive
// en su propio documento (`certificadosOnerrd/factura-imagen-<ms>`, un data
// URL de hasta ~900 KB: varias juntas no cabrían en el MB de un documento); el
// diseño guarda solo dónde va, su tamaño y su giro. Quitarla del diseño no
// borra su documento: las facturas ya emitidas con ella siguen saliendo igual.
export const PREFIJO_IMAGEN_FACTURA_ONERRD = 'factura-imagen-';

export const MAXIMO_IMAGENES_FACTURA_ONERRD = 10;

export const esIdImagenFacturaOnerrd = (id) => /^factura-imagen-\d{10,16}$/.test(String(id ?? ''));

export const crearIdImagenFacturaOnerrd = (ahora = Date.now()) =>
  `${PREFIJO_IMAGEN_FACTURA_ONERRD}${ahora}`;

// x, y = su centro; ancho en % de la página (el alto sale de su proporción).
export const IMAGEN_NUEVA_FACTURA_ONERRD = Object.freeze({
  x: 50,
  y: 50,
  ancho: 20,
  rotacion: 0,
  visible: true,
});

// FORMAS: rectángulos de color que se mueven, estiran, giran e inclinan; con
// ellas se dibujan las barras, rayas y recuadros de la factura (la raya
// dorada de la cabecera, la barra de "FACTURAR A", el pie…). x, y = su
// centro en % de la página; ancho en % de la página; alto en pt (una raya
// de 1 pt no se puede dar en % del alto). `relleno` y `colorBorde` vacíos =
// sin relleno / sin borde. `esquinas`: cuáles se redondean (la barra de
// "FACTURAR A", solo las de arriba). `inclinacion`: grados de sesgo
// horizontal (las puntas en bisel de las barras del pie).
export const ESQUINAS_FORMA_FACTURA = Object.freeze(['todas', 'arriba', 'abajo']);

export const MAXIMO_FORMAS_FACTURA_ONERRD = 30;

export const FORMA_NUEVA_FACTURA_ONERRD = Object.freeze({
  etiqueta: 'Forma',
  visible: true,
  x: 50,
  y: 50,
  ancho: 30,
  alto: 20,
  relleno: NAVY,
  colorBorde: '',
  grosorBorde: 0,
  radio: 0,
  esquinas: 'todas',
  inclinacion: 0,
  rotacion: 0,
});

// De una caja en puntos (izquierda, arriba, ancho, alto) a una forma.
const forma = (id, etiqueta, izquierda, arriba, ancho, alto, estilo = {}) => ({
  ...FORMA_NUEVA_FACTURA_ONERRD,
  id,
  etiqueta,
  x: redondear(((izquierda + ancho / 2) / PAGINA_FACTURA_ONERRD.ancho) * 100),
  y: redondear(((arriba + alto / 2) / PAGINA_FACTURA_ONERRD.alto) * 100),
  ancho: redondear((ancho / PAGINA_FACTURA_ONERRD.ancho) * 100),
  alto,
  ...estilo,
});

export const FORMAS_DE_FABRICA_FACTURA_ONERRD = Object.freeze(
  [
    forma('divisorCabecera', 'Raya de la cabecera', 369.2, 38, 1.6, 102, { relleno: ORO }),
    forma('subrayadoTitulo', 'Subrayado de FACTURA', 400, 83.6, 52, 2.8, { relleno: ORO }),
    forma('recuadroFacturarA', 'Recuadro de «Facturar a»', 32, 155.6, 548, 54.4, {
      relleno: '',
      colorBorde: NAVY,
      grosorBorde: 1.2,
      radio: 5,
    }),
    forma('barraFacturarA', 'Barra de «Facturar a»', 32, 155.6, 548, 20.4, {
      radio: 5,
      esquinas: 'arriba',
    }),
    forma('barraPie', 'Barra del pie', 32, 735.5, 418, 4.5, { inclinacion: -35 }),
    forma('barraPieOro', 'Barra dorada del pie', 452, 735.75, 128, 4, {
      relleno: ORO,
      inclinacion: -35,
    }),
    forma('rayaPieIzquierda', 'Raya del pie (izquierda)', 32, 759.5, 124, 1, { relleno: ORO }),
    forma('rayaPieDerecha', 'Raya del pie (derecha)', 456, 759.5, 124, 1, { relleno: ORO }),
  ].map((item) => Object.freeze(item))
);

export const esIdFormaFacturaOnerrd = (id) =>
  /^[A-Za-z][A-Za-z0-9_-]{0,39}$/.test(String(id ?? ''));

export const crearIdFormaFacturaOnerrd = (existentes = []) => {
  const usados = new Set(existentes.map((item) => item.id));
  let indice = existentes.length + 1;
  while (usados.has(`forma${indice}`)) indice += 1;
  return `forma${indice}`;
};

export const sanearFormaFactura = (entrada = {}) => {
  const f = FORMA_NUEVA_FACTURA_ONERRD;
  return {
    id: entrada.id,
    etiqueta: texto(entrada.etiqueta, 60) || f.etiqueta,
    visible: entrada.visible !== false,
    x: acotarPosicion(numero(entrada.x, f.x)),
    y: acotarPosicion(numero(entrada.y, f.y)),
    ancho: redondear(acotar(numero(entrada.ancho, f.ancho), 0.1, 100)),
    alto: redondear(acotar(numero(entrada.alto, f.alto), 0.25, PAGINA_FACTURA_ONERRD.alto)),
    relleno: colorOVacio(entrada.relleno ?? f.relleno, f.relleno),
    colorBorde: colorOVacio(entrada.colorBorde ?? f.colorBorde, NAVY),
    grosorBorde: redondear(acotar(numero(entrada.grosorBorde, f.grosorBorde), 0, 10)),
    radio: redondear(acotar(numero(entrada.radio, f.radio), 0, 100)),
    esquinas: ESQUINAS_FORMA_FACTURA.includes(entrada.esquinas) ? entrada.esquinas : f.esquinas,
    inclinacion: redondear(acotar(numero(entrada.inclinacion, 0), -60, 60)),
    rotacion: acotarRotacionOnerrd(numero(entrada.rotacion, 0)),
  };
};

const sanearFormasFactura = (lista) => {
  const vistas = new Set();
  return (Array.isArray(lista) ? lista : [])
    .filter((item) => {
      if (!esIdFormaFacturaOnerrd(item?.id) || vistas.has(item.id)) return false;
      vistas.add(item.id);
      return true;
    })
    .slice(0, MAXIMO_FORMAS_FACTURA_ONERRD)
    .map(sanearFormaFactura);
};

const sanearImagenesFactura = (lista) => {
  const vistas = new Set();
  return (Array.isArray(lista) ? lista : [])
    .filter((imagen) => {
      if (!esIdImagenFacturaOnerrd(imagen?.id) || vistas.has(imagen.id)) return false;
      vistas.add(imagen.id);
      return true;
    })
    .slice(0, MAXIMO_IMAGENES_FACTURA_ONERRD)
    .map((imagen) => {
      const f = IMAGEN_NUEVA_FACTURA_ONERRD;
      return {
        id: imagen.id,
        visible: imagen.visible !== false,
        x: acotarPosicion(numero(imagen.x, f.x)),
        y: acotarPosicion(numero(imagen.y, f.y)),
        ancho: redondear(acotar(numero(imagen.ancho, f.ancho), 2, 100)),
        rotacion: acotarRotacionOnerrd(numero(imagen.rotacion, 0)),
      };
    });
};

const sanearCampoFactura = (entrada) => {
  const fabrica = CAMPOS_DE_FABRICA_FACTURA_ONERRD.find((item) => item.id === entrada?.id);
  const campo = sanearCampoOnerrd({ ...fabrica, ...entrada });
  // De fábrica de la FACTURA (no se borra, solo se oculta).
  return { ...campo, deFabrica: Boolean(fabrica) };
};

// Sin tabla (diseño de fábrica), la de fábrica; una guardada sin las claves
// del encabezado relleno se queda como era (`TABLA_ANTIGUA`).
const sanearTabla = (guardada) => {
  const entrada = guardada || {};
  const f = TABLA_DE_FABRICA_FACTURA_ONERRD;
  const nueva = guardada ? TABLA_ANTIGUA : f;
  const titulos = Object.fromEntries(
    Object.entries(f.titulos).map(([clave, valor]) => [
      clave,
      texto(entrada.titulos?.[clave] ?? valor, 40),
    ])
  );
  return {
    visible: entrada.visible !== false,
    x: acotarPosicion(numero(entrada.x, f.x)),
    y: acotarPosicion(numero(entrada.y, f.y)),
    ancho: redondear(acotar(numero(entrada.ancho, f.ancho), 20, 100)),
    filas: Math.round(acotar(numero(entrada.filas, f.filas), 1, 20)),
    altoFila: redondear(acotar(numero(entrada.altoFila, f.altoFila), 10, 60)),
    fuente: fuenteValida(entrada.fuente, f.fuente),
    tamano: redondear(acotar(numero(entrada.tamano, f.tamano), 5, 20)),
    colorTexto: colorHex(entrada.colorTexto, f.colorTexto),
    colorBorde: colorHex(entrada.colorBorde, f.colorBorde),
    grosorBorde: redondear(acotar(numero(entrada.grosorBorde, f.grosorBorde), 0, 6)),
    colorFranja: colorHex(entrada.colorFranja, f.colorFranja),
    colorImporte: colorHex(entrada.colorImporte, f.colorImporte),
    colorTotal: colorHex(entrada.colorTotal, f.colorTotal),
    colorEncabezado: colorOVacio(entrada.colorEncabezado ?? nueva.colorEncabezado, NAVY),
    colorTextoEncabezado: colorOVacio(
      entrada.colorTextoEncabezado ?? nueva.colorTextoEncabezado,
      BLANCO
    ),
    radio: redondear(acotar(numero(entrada.radio, nueva.radio), 0, 30)),
    separacionTotal: redondear(
      acotar(numero(entrada.separacionTotal, nueva.separacionTotal), 0, 60)
    ),
    titulos,
  };
};

const sanearSello = (guardado) => {
  const entrada = guardado || {};
  const f = SELLO_DE_FABRICA_FACTURA_ONERRD;
  return {
    visible: entrada.visible !== false,
    x: acotarPosicion(numero(entrada.x, f.x)),
    y: acotarPosicion(numero(entrada.y, f.y)),
    ancho: redondear(acotar(numero(entrada.ancho, f.ancho), 8, 100)),
    rotacion: acotarRotacionOnerrd(numero(entrada.rotacion, f.rotacion)),
    fuente: fuenteValida(entrada.fuente, f.fuente),
    colorTexto: colorHex(entrada.colorTexto, f.colorTexto),
    colorBorde: colorHex(entrada.colorBorde, f.colorBorde),
    grosorBorde: redondear(acotar(numero(entrada.grosorBorde, f.grosorBorde), 0, 10)),
    radio: redondear(acotar(numero(entrada.radio, guardado ? 0 : f.radio), 0, 60)),
  };
};

const sanearLogo = (entrada = {}) => {
  const f = LOGO_DE_FABRICA_FACTURA_ONERRD;
  return {
    visible: entrada.visible !== false,
    x: acotarPosicion(numero(entrada.x, f.x)),
    y: acotarPosicion(numero(entrada.y, f.y)),
    ancho: redondear(acotar(numero(entrada.ancho, f.ancho), 2, 100)),
    rotacion: acotarRotacionOnerrd(numero(entrada.rotacion, 0)),
  };
};

const sanearLineaDeDiseno = (entrada = {}) => {
  const f = LINEA_DE_FABRICA_FACTURA_ONERRD;
  return {
    visible: (entrada.visible ?? f.visible) !== false,
    x: acotarPosicion(numero(entrada.x, f.x)),
    y: acotarPosicion(numero(entrada.y, f.y)),
    ancho: redondear(acotar(numero(entrada.ancho, f.ancho), 2, 100)),
    grosor: redondear(acotar(numero(entrada.grosor, f.grosor), 0.25, 10)),
    color: colorHex(entrada.color, f.color),
  };
};

// Como `sanearDisenoOnerrd`: un diseño ausente o roto vuelve al de fábrica,
// y un campo de fábrica nunca se pierde (se oculta). Lleva además lo que el
// lienzo del certificado espera (sin imagen, firmas ni QR).
export const sanearDisenoFacturaOnerrd = (diseno = {}) => {
  const guardados = Array.isArray(diseno?.campos) ? diseno.campos : null;
  const vistos = new Set();
  const campos = (guardados || CAMPOS_DE_FABRICA_FACTURA_ONERRD)
    .map(sanearCampoFactura)
    .filter((campo) => {
      if (vistos.has(campo.id)) return false;
      vistos.add(campo.id);
      return true;
    });
  // Un texto de fábrica que no estaba en un diseño guardado (porque llegó
  // después, como el pie) se añade OCULTO: si no, aparecía de pronto en las
  // facturas ya emitidas con ese diseño.
  CAMPOS_DE_FABRICA_FACTURA_ONERRD.forEach((fabrica) => {
    if (vistos.has(fabrica.id)) return;
    campos.push(sanearCampoFactura(guardados ? { ...fabrica, visible: false } : fabrica));
  });

  const oculto = { visible: false, x: 50, y: 50, ancho: 10 };
  return {
    campos,
    tabla: sanearTabla(diseno?.tabla),
    sello: sanearSello(diseno?.sello),
    linea: sanearLineaDeDiseno(diseno?.linea),
    logo: sanearLogo(diseno?.logo),
    imagenes: sanearImagenesFactura(diseno?.imagenes),
    // Un diseño guardado antes de las formas no las tenía: se queda sin ellas.
    formas: sanearFormasFactura(
      Array.isArray(diseno?.formas)
        ? diseno.formas
        : guardados
          ? []
          : FORMAS_DE_FABRICA_FACTURA_ONERRD
    ),
    firmas: [],
    imagen: oculto,
    iconoRegion: oculto,
    qr: { ...oculto, color: '#000000' },
  };
};

// Para guardar: solo lo de la factura.
export const disenoFacturaParaGuardar = (diseno) => {
  const { campos, tabla, sello, linea, logo, imagenes, formas } = sanearDisenoFacturaOnerrd(diseno);
  return { campos, tabla, sello, linea, logo, imagenes, formas };
};

export const esCampoDeFabricaFactura = (id) => IDS_DE_FABRICA.has(id);

// ---------------------------------------------------------------- medidas (pt)

// La tabla con sus filas y los totales debajo. Las MISMAS cajas pintan la
// vista previa y el PDF.
export const cajaDeTablaFactura = (tabla, datos, pagina = PAGINA_FACTURA_ONERRD) => {
  const width = (tabla.ancho / 100) * pagina.ancho;
  const left = (tabla.x / 100) * pagina.ancho - width / 2;
  const top = (tabla.y / 100) * pagina.alto;
  const alto = tabla.altoFila;
  const separacion = tabla.separacionTotal || 0;

  let x = left;
  const columnas = COLUMNAS_TABLA_FACTURA.map((parte) => {
    const columna = { left: x, width: width * parte };
    x += width * parte;
    return columna;
  });

  const lineas = datos?.lineas || [];
  const cuantas = Math.max(tabla.filas, lineas.length);
  const filas = Array.from({ length: cuantas }, (_, i) => ({
    top: top + alto * (i + 1),
    height: alto,
    franja: i % 2 === 0,
    linea: lineas[i] || null,
  }));
  const bottom = top + alto * (cuantas + 1);

  // Bajo la tabla: subtotal, descuento e impuestos solo si hay alguno de los
  // dos (como el ejemplo, que solo lleva TOTAL).
  const conDesglose = !!(datos?.descuento || datos?.impuestos);
  const totales = [
    ...(conDesglose ? [{ etiqueta: 'SUBTOTAL', valor: datos.subtotal }] : []),
    ...(datos?.descuento ? [{ etiqueta: 'DESCUENTO', valor: `-${datos.descuento}` }] : []),
    ...(datos?.impuestos
      ? [{ etiqueta: `IMPUESTOS (${datos.porcentajeImpuestos}%)`, valor: datos.impuestos }]
      : []),
    { etiqueta: tabla.titulos.total, valor: datos?.total || '', total: true },
  ].map((fila, i) => ({ ...fila, top: bottom + separacion + alto * i, height: alto }));

  // Con el encabezado relleno, los totales van en su caja aparte: el rótulo
  // en navy bajo CANTIDAD (bajo PRECIO y CANTIDAD si hay desglose, que
  // "IMPUESTOS (18%)" no cabe en una columna) y el valor bajo IMPORTE.
  const etiquetaTotales = conDesglose
    ? { left: columnas[1].left, width: columnas[1].width + columnas[2].width }
    : { left: columnas[2].left, width: columnas[2].width };

  return {
    left,
    top,
    width,
    alto,
    columnas,
    encabezado: { top, height: alto },
    filas,
    bottom,
    totales,
    etiquetaTotales,
    marcoTotales: {
      left: etiquetaTotales.left,
      top: bottom + separacion,
      width: etiquetaTotales.width + columnas[3].width,
      height: alto * totales.length,
    },
    height: bottom - top + separacion + alto * totales.length,
  };
};

// El sello: recuadro del ancho guardado; la letra, la que quepa (PENDIENTE
// es más largo que PAGADO y no puede salirse del recuadro).
export const cajaDeSelloFactura = (sello, textoSello, pagina = PAGINA_FACTURA_ONERRD) => {
  const width = (sello.ancho / 100) * pagina.ancho;
  const letras = Math.max(1, String(textoSello || '').length);
  const relleno = width * 0.08;
  const tamano = redondear(Math.min(width * 0.14, (width - relleno * 2) / (letras * 0.78)));
  const height = tamano * 1.2 + relleno * 0.9 + sello.grosorBorde * 2;
  return {
    left: (sello.x / 100) * pagina.ancho - width / 2,
    top: (sello.y / 100) * pagina.alto - height / 2,
    width,
    height,
    tamano,
    espaciado: redondear(tamano * 0.07),
  };
};

export const cajaDeFormaFactura = (item, pagina = PAGINA_FACTURA_ONERRD) => {
  const width = (item.ancho / 100) * pagina.ancho;
  return {
    left: (item.x / 100) * pagina.ancho - width / 2,
    top: (item.y / 100) * pagina.alto - item.alto / 2,
    width,
    height: item.alto,
  };
};

// El radio de cada esquina (arriba-izq., arriba-der., abajo-der., abajo-izq.),
// nunca mayor que media caja. Lo usan la vista previa y el PDF.
export const radiosDeEsquinas = (radio, esquinas = 'todas', caja = null) => {
  const r = caja ? Math.min(radio, caja.width / 2, caja.height / 2) : radio;
  const arriba = esquinas !== 'abajo' ? r : 0;
  const abajo = esquinas !== 'arriba' ? r : 0;
  return { tl: arriba, tr: arriba, br: abajo, bl: abajo };
};

export const cajaDeLineaFactura = (linea, pagina = PAGINA_FACTURA_ONERRD) => {
  const width = (linea.ancho / 100) * pagina.ancho;
  return {
    left: (linea.x / 100) * pagina.ancho - width / 2,
    top: (linea.y / 100) * pagina.alto - linea.grosor / 2,
    width,
    height: linea.grosor,
  };
};
