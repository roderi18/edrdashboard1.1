// CERTIFICADO ONERRD: numeración AÑO-001, saneado del diseño y medidas.
//
// Qué protege: el número del registro va impreso en certificados entregados,
// así que su formato no puede cambiar ni repetirse; y un diseño guardado roto
// (un campo sin tipo, una posición NaN) no puede dejar la pantalla en blanco
// ni perder los campos de fábrica. Las medidas son las mismas en la vista
// previa y en el PDF: si se separan, lo que se ve no es lo que sale.

import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';

import {
  INTERLINEADO_ONERRD,
  CAMPOS_DE_FABRICA_ONERRD,
  crearIdDeCampo,
  paginaDesdeSvg,
  acotarPosicion,
  idContadorOnerrd,
  cajaDeTextoOnerrd,
  sanearDisenoOnerrd,
  cajaDeImagenOnerrd,
  textoDeCampoOnerrd,
  sanearCampoOnerrd,
  textosParaPintarOnerrd,
  rutaPdfOnerrd,
  crearClaveOnerrd,
  esClaveOnerrdValida,
  esNumeroOnerrdValido,
  urlDelCertificadoOnerrd,
  urlDelPdfOnerrd,
  regionOnerrd,
  REGIONES_ONERRD,
  idDocumentoIconoRegionOnerrd,
  ICONO_REGION_DE_FABRICA_ONERRD,
  formatearFechaHoraOnerrd,
  acotarRotacionOnerrd,
  claveDeValorOnerrd,
  seEscribeEnElLienzoOnerrd,
  paradasDeDegradadoOnerrd,
  cssDeDegradadoOnerrd,
  lineaDeDegradadoOnerrd,
  PESOS_ONERRD,
  FUENTES_ONERRD,
  pesoDeCampoOnerrd,
  ESPACIADO_MINIMO_ONERRD,
  desplazamientosDeContorno,
  formatearFechaOnerrd,
  tamanoQueCabeOnerrd,
  esAnioDeRegistroValido,
  formatearNumeroOnerrd,
  nombreDeArchivoOnerrd,
  anioDeRegistroPropuesto,
  siguienteSecuenciaOnerrd,
  rutaFirmaOnerrd,
  rutaPlantillaOnerrd,
  esIdImagenSubidaOnerrd,
  crearIdImagenSubidaOnerrd,
  formatearEmisionOnerrd,
  restaurarDePapeleraOnerrd,
  quitarCamposAPapeleraOnerrd,
} from '../../src/utils/certificado-onerrd.mjs';
import { direccionPublica, DIRECCIONES_PUBLICAS } from '../../src/utils/direccion-publica.mjs';

test('el número del registro es AÑO-001 y sigue contando sin límite', () => {
  assert.equal(formatearNumeroOnerrd(2027, 1), '2027-001');
  assert.equal(formatearNumeroOnerrd(2027, 42), '2027-042');
  assert.equal(formatearNumeroOnerrd(2027, 1000), '2027-1000');
  assert.equal(formatearNumeroOnerrd(2027, 0), '');
  assert.equal(formatearNumeroOnerrd('x', 1), '');
});

test('el contador sigue desde el último emitido, uno por año', () => {
  assert.equal(siguienteSecuenciaOnerrd(undefined), 1);
  assert.equal(siguienteSecuenciaOnerrd(0), 1);
  assert.equal(siguienteSecuenciaOnerrd(7), 8);
  assert.equal(siguienteSecuenciaOnerrd(-3), 1);
  assert.equal(idContadorOnerrd(2027), 'contador-2027');
  assert.ok(esAnioDeRegistroValido(2027));
  assert.ok(!esAnioDeRegistroValido(27));
  assert.ok(!esAnioDeRegistroValido(2027.5));
});

test('de septiembre en adelante se propone el registro del año siguiente', () => {
  assert.equal(anioDeRegistroPropuesto(new Date(2026, 9, 11)), 2027);
  assert.equal(anioDeRegistroPropuesto(new Date(2026, 2, 1)), 2026);
});

test('un diseño vacío o roto vuelve a los campos de fábrica sin perder ninguno', () => {
  const vacio = sanearDisenoOnerrd();
  assert.deepEqual(
    vacio.campos.map((campo) => campo.id),
    CAMPOS_DE_FABRICA_ONERRD.map((campo) => campo.id)
  );
  assert.equal(vacio.firmas.length, 2);

  const roto = sanearDisenoOnerrd({
    campos: [
      { id: 'pastor', x: 'NaN', tamano: 9999, color: 'rojo', fuente: 'Comic' },
      { id: 'pastor', etiqueta: 'duplicado' },
      { id: 'texto8', etiqueta: 'Región', tipo: 'raro' },
    ],
    firmas: [{ id: 'firma2', x: 500, ancho: -1 }],
  });
  const pastor = roto.campos.find((campo) => campo.id === 'pastor');
  assert.equal(pastor.x, 50);
  assert.equal(pastor.tamano, 160);
  // Un color roto vuelve al de fábrica (el azul de la plantilla), no al negro.
  assert.equal(pastor.color, '#1B2F5E');
  // Una fuente que no existe vuelve a la de la plantilla.
  assert.equal(pastor.fuente, 'Oswald');
  assert.equal(roto.campos.filter((campo) => campo.id === 'pastor').length, 1);
  assert.equal(roto.campos.find((campo) => campo.id === 'texto8').tipo, 'texto');
  // Los de fábrica que faltaban vuelven.
  assert.ok(roto.campos.some((campo) => campo.id === 'numeroRegistro'));
  assert.equal(roto.firmas[1].x, 105);
  assert.equal(roto.firmas[1].ancho, 2);
});

test('Roboto no tiene cursiva: no se guarda una que el PDF no puede pintar', () => {
  const { campos } = sanearDisenoOnerrd({
    campos: [{ id: 'iglesia', fuente: 'Roboto', cursiva: true }],
  });
  assert.equal(campos.find((campo) => campo.id === 'iglesia').cursiva, false);
});

test('los ids nuevos no chocan con los existentes', () => {
  assert.equal(crearIdDeCampo([{ id: 'a' }]), 'texto2');
  assert.equal(crearIdDeCampo([{ id: 'texto2' }, { id: 'b' }]), 'texto3');
});

test('una posición nunca se pierde fuera del alcance del ratón', () => {
  assert.equal(acotarPosicion(-40), -5);
  assert.equal(acotarPosicion(300), 105);
  assert.equal(acotarPosicion(33.333), 33.33);
});

test('el texto de cada campo: número, fecha y mayúsculas; el ejemplo nunca se pinta', () => {
  const por = (id) => sanearDisenoOnerrd().campos.find((c) => c.id === id);
  const [numero, fecha, iglesia] = ['numeroRegistro', 'fecha', 'iglesia'].map(por);
  const valores = {
    numeroRegistro: '2027-001',
    fecha: '2026-10-11T12:00:00',
    iglesia: 'Asamblea de Dios',
  };
  assert.equal(textoDeCampoOnerrd(numero, valores), '2027-001');
  assert.equal(textoDeCampoOnerrd(fecha, valores), '11/10/2026');
  assert.equal(textoDeCampoOnerrd(iglesia, valores), 'ASAMBLEA DE DIOS');
  // Sin dato, la iglesia deja su texto fijo (ver el test de ASAMBLEA DE DIOS).
  assert.equal(textoDeCampoOnerrd(iglesia, {}), 'ASAMBLEA DE DIOS “”');
  assert.equal(formatearFechaOnerrd('no es fecha'), '');
});

// Lo que se ve en el lienzo es lo que sale en el PDF. Antes la vista previa
// enseñaba el "Texto de ejemplo" como si fuera el dato: quien escribía ahí el
// número de destacamento, la iglesia, el pastor o el coordinador lo veía en el
// certificado, y el PDF salía sin ninguno de los cuatro.
test('la vista previa y el PDF pintan los mismos textos, sin ejemplos', () => {
  const diseno = sanearDisenoOnerrd();
  const medir = (texto) => texto.length * 0.5;
  const valores = {
    numeroRegistro: '2027-004',
    fecha: '2026-10-11T12:00:00',
    numeroDestacamento: '117',
    iglesia: 'Asamblea de Dios',
    pastor: 'Juan Pérez',
    coordinador: 'Ana Gómez',
  };
  const textos = textosParaPintarOnerrd(diseno, valores, 792, medir);
  const por = Object.fromEntries(textos.map((t) => [t.campo.id, t.texto]));
  assert.equal(por.numeroDestacamento, '117');
  assert.equal(por.iglesia, 'ASAMBLEA DE DIOS');
  assert.equal(por.pastor, 'JUAN PÉREZ');
  assert.equal(por.coordinador, 'ANA GÓMEZ');
  // Sin dato no sale el ejemplo ("Halcones del Este"): ni en pantalla ni en el PDF.
  assert.equal(por.nombreDestacamento, '');
  // Un campo oculto no se pinta.
  const oculto = {
    ...diseno,
    campos: diseno.campos.map((c) => (c.id === 'pastor' ? { ...c, visible: false } : c)),
  };
  assert.ok(
    !textosParaPintarOnerrd(oculto, valores, 792, medir).some((t) => t.campo.id === 'pastor')
  );
});

test('un texto largo se encoge hasta caber en su caja, nunca crece', () => {
  const campo = {
    ...sanearDisenoOnerrd().campos.find((c) => c.id === 'iglesia'),
    ancho: 50,
    tamano: 20,
    espaciado: 0,
  };
  const medir = (texto) => texto.length * 0.5; // 0.5 pt por letra a 1 pt
  // Caja de 396 pt: 10 letras a 20 pt = 100 pt, cabe.
  assert.equal(tamanoQueCabeOnerrd(campo, 'x'.repeat(10), 792, medir), 20);
  // 100 letras: 50 pt a 1 pt → cabe a 7,92 pt.
  assert.equal(tamanoQueCabeOnerrd(campo, 'x'.repeat(100), 792, medir), 7.92);
  assert.equal(
    tamanoQueCabeOnerrd({ ...campo, ajustarAlAncho: false }, 'x'.repeat(100), 792, medir),
    20
  );
});

test('las cajas del PDF salen del centro guardado', () => {
  const pagina = { ancho: 792, alto: 612 };
  const caja = cajaDeTextoOnerrd({ x: 50, y: 50, ancho: 50 }, 10, pagina);
  assert.deepEqual(caja, { left: 198, top: 306 - (10 * INTERLINEADO_ONERRD) / 2, width: 396 });
  assert.deepEqual(cajaDeImagenOnerrd({ x: 50, y: 50, ancho: 10 }, 0.5, pagina), {
    left: 356.4,
    top: 286.2,
    width: 79.2,
    height: 39.6,
  });
});

test('la página sale del viewBox del SVG', () => {
  assert.deepEqual(paginaDesdeSvg('<svg width="1056" viewBox="0 0 792 611.999999" height="816">'), {
    ancho: 792,
    alto: 612,
  });
  assert.deepEqual(paginaDesdeSvg('<svg width="800" height="600">'), { ancho: 800, alto: 600 });
  assert.deepEqual(paginaDesdeSvg('nada'), { ancho: 792, alto: 612 });
});

test('el nombre del PDF lleva el número y el destacamento sin acentos', () => {
  assert.equal(
    nombreDeArchivoOnerrd('2027-001', { nombreDestacamento: 'Tribu de Judá' }),
    'ONERRD-2027-001-Tribu-de-Juda.pdf'
  );
  assert.equal(nombreDeArchivoOnerrd('', {}), 'ONERRD-prueba.pdf');
});

// El número del laurel va como en la plantilla: Anton amarilla con contorno
// granate. Los diseños guardados antes del contorno no traían la clave y se
// habrían quedado con la Helvetica azul; los de después mandan, también
// cuando se quitó el contorno.
test('el número del destacamento: letra de la plantilla, y lo guardado manda', () => {
  const numero = (d) => sanearDisenoOnerrd(d).campos.find((c) => c.id === 'numeroDestacamento');
  const deFabrica = numero();
  assert.equal(deFabrica.fuente, 'Anton');
  assert.equal(deFabrica.contorno, '#9A2222');
  assert.ok(deFabrica.grosorContorno > 0);

  const antiguo = numero({
    campos: [{ id: 'numeroDestacamento', fuente: 'Helvetica', negrita: true, x: 30, tamano: 33 }],
  });
  assert.equal(antiguo.fuente, 'Anton');
  assert.equal(antiguo.contorno, '#9A2222');
  assert.equal(antiguo.negrita, false);
  assert.equal(antiguo.x, 30); // sitio y tamaño, los suyos
  assert.equal(antiguo.tamano, 33);

  const sinContorno = numero({
    campos: [{ id: 'numeroDestacamento', fuente: 'Times', contorno: '', grosorContorno: 3 }],
  });
  assert.equal(sinContorno.fuente, 'Times');
  assert.equal(sinContorno.contorno, '');
  assert.equal(sinContorno.grosorContorno, 0);
});

test('contorno y espaciado: acotados, y Anton sin negrita que el PDF no pinta', () => {
  const [campo] = sanearDisenoOnerrd({
    campos: [
      {
        id: 'iglesia',
        fuente: 'Anton',
        negrita: true,
        contorno: '#abcdef',
        grosorContorno: 99,
        espaciado: -50,
      },
    ],
  }).campos;
  assert.equal(campo.negrita, false);
  assert.equal(campo.contorno, '#ABCDEF');
  assert.equal(campo.grosorContorno, 20);
  assert.equal(campo.espaciado, ESPACIADO_MINIMO_ONERRD);
  const [roto] = sanearDisenoOnerrd({ campos: [{ id: 'pastor', contorno: 'rojo' }] }).campos;
  assert.equal(roto.contorno, '');
});

// La vista previa (text-shadow) y el PDF (copias) dibujan el borde con estos
// mismos puntos: si se separan, el contorno de la pantalla no es el del PDF.
test('el contorno es un círculo del radio del grosor', () => {
  assert.deepEqual(desplazamientosDeContorno(0), []);
  const puntos = desplazamientosDeContorno(2);
  assert.ok(puntos.length >= 16);
  puntos.forEach(([dx, dy]) => assert.ok(Math.abs(Math.hypot(dx, dy) - 2) < 0.01));
});

test('el contorno ocupa caja: un número con borde se encoge un poco más', () => {
  const base = {
    ...sanearDisenoOnerrd().campos.find((c) => c.id === 'iglesia'),
    ancho: 10,
    tamano: 100,
    espaciado: 0,
  };
  const medir = (texto) => texto.length * 0.5;
  const sin = tamanoQueCabeOnerrd({ ...base, contorno: '' }, '001', 792, medir);
  const con = tamanoQueCabeOnerrd(
    { ...base, contorno: '#000000', grosorContorno: 3 },
    '001',
    792,
    medir
  );
  assert.ok(con < sin);
});

// La iglesia va con la letra de los rótulos de la plantilla (Oswald, que sí
// tiene negrita); un diseño guardado con otra fuente la conserva.
test('la iglesia sale en Oswald con las letras abiertas', () => {
  const iglesia = (d) => sanearDisenoOnerrd(d).campos.find((c) => c.id === 'iglesia');
  assert.equal(iglesia().fuente, 'Oswald');
  assert.ok(iglesia().espaciado > 0);
  assert.equal(
    iglesia({ campos: [{ id: 'iglesia', fuente: 'Oswald', negrita: true }] }).negrita,
    true
  );
  assert.equal(iglesia({ campos: [{ id: 'iglesia', fuente: 'Times' }] }).fuente, 'Times');
});

// Oswald, como la de Google Fonts (wght 200..700): el grueso elegido llega al
// PDF. Los diseños guardados antes, con Helvetica porque era la de por
// defecto, pasan a Oswald sin perder su negrita; una letra elegida a propósito
// (Times) se queda.
test('Oswald para todos los textos, con sus seis gruesos', () => {
  const diseno = sanearDisenoOnerrd();
  // Menos los dos de Anton: el número del laurel y el año junto a REGISTRO.
  diseno.campos
    .filter((c) => !['numeroDestacamento', 'anioRegistro'].includes(c.id))
    .forEach((c) => assert.equal(c.fuente, 'Oswald', c.id));
  assert.deepEqual(Object.keys(PESOS_ONERRD).map(Number), [200, 300, 400, 500, 600, 700]);

  const campo = (c) => sanearDisenoOnerrd({ campos: [c] }).campos.find((x) => x.id === c.id);
  assert.equal(campo({ id: 'pastor', fuente: 'Oswald', peso: 300 }).peso, 300);
  assert.equal(campo({ id: 'pastor', fuente: 'Oswald', peso: 300 }).negrita, false);
  assert.equal(campo({ id: 'pastor', fuente: 'Oswald', peso: 650 }).peso, 400);

  const antiguo = campo({ id: 'pastor', fuente: 'Helvetica', negrita: true });
  assert.equal(antiguo.fuente, 'Oswald');
  assert.equal(antiguo.peso, 700);
  assert.equal(campo({ id: 'pastor', fuente: 'Times' }).fuente, 'Times');
  // Guardado ya con grueso: Helvetica es una elección y se respeta.
  assert.equal(campo({ id: 'pastor', fuente: 'Helvetica', peso: 400 }).fuente, 'Helvetica');
  // Sin gruesos propios, el peso sale de la negrita.
  assert.equal(campo({ id: 'pastor', fuente: 'Times', negrita: true, peso: 300 }).peso, 700);
  assert.equal(pesoDeCampoOnerrd({ negrita: true }), 700);
});

// El PDF ponía los textos más abajo que la vista previa (1-2 pt en los de
// Oswald, 6 pt en el número de Anton): el navegador reparte el interlineado
// arriba y abajo y el PDF no. La caja del PDF se corrige con la línea base que
// mide el navegador y la altura de letra que usa el PDF.
test('el PDF pone cada texto a la altura de la vista previa', () => {
  const pagina = { ancho: 792, alto: 612 };
  const campo = { x: 50, y: 50, ancho: 50, fuente: 'Oswald' };
  const sin = cajaDeTextoOnerrd(campo, 20, pagina);
  const con = cajaDeTextoOnerrd(campo, 20, pagina, 1.052);
  // Línea base del PDF (arriba + ascenso) = la de pantalla (arriba de la línea + 1.052).
  assert.ok(Math.abs(con.top + 1.193 * 20 - (sin.top + 1.052 * 20)) < 1e-9);
  // Sin medida (fuera del navegador), la caja de siempre.
  assert.equal(cajaDeTextoOnerrd(campo, 20, pagina, 0).top, sin.top);
});

// `ascensoPdf` ha de ser el `ascent` del archivo, que es lo que usa react-pdf:
// si se cambia una fuente de `public/fuentes`, este test lo dice.
test('la altura de letra del PDF coincide con los archivos de fuente', async () => {
  const fontkit = createRequire(import.meta.url)('fontkit');
  const archivos = { Roboto: 'Roboto-Regular', Oswald: 'Oswald-Regular', Anton: 'Anton-Regular' };
  Object.entries(archivos).forEach(([fuente, archivo]) => {
    const letra = fontkit.openSync(`public/fuentes/${archivo}.ttf`);
    const esperado = letra.ascent / letra.unitsPerEm;
    const { ascensoPdf } = FUENTES_ONERRD.find((item) => item.value === fuente);
    assert.ok(Math.abs(ascensoPdf - esperado) < 1e-6, fuente);
  });
});

// La iglesia siempre sale ASAMBLEA DE DIOS “…”: se escribe solo el nombre.
// Quien escribe el nombre completo (o un certificado emitido antes de este
// texto fijo) no recibe la frase dos veces.
test('la iglesia lleva siempre ASAMBLEA DE DIOS y el nombre entre comillas', () => {
  const iglesia = (d) => sanearDisenoOnerrd(d).campos.find((c) => c.id === 'iglesia');
  const campo = iglesia();
  const texto = (valor) => textoDeCampoOnerrd(campo, { iglesia: valor });
  assert.equal(texto('Del Libertador'), 'ASAMBLEA DE DIOS “DEL LIBERTADOR”');
  assert.equal(texto(''), 'ASAMBLEA DE DIOS “”');
  assert.equal(texto('Asamblea de Dios "Aposento Alto"'), 'ASAMBLEA DE DIOS "APOSENTO ALTO"');
  assert.equal(texto('asamblea de díos Del Rey'), 'ASAMBLEA DE DÍOS DEL REY');
  // Un diseño guardado antes lo toma de fábrica; uno que lo quitó, no.
  assert.equal(iglesia({ campos: [{ id: 'iglesia', peso: 400 }] }).prefijo, 'Asamblea de Dios “');
  const sinFijo = iglesia({ campos: [{ id: 'iglesia', prefijo: '', sufijo: '' }] });
  assert.equal(textoDeCampoOnerrd(sinFijo, { iglesia: 'Libre' }), 'LIBRE');
  // Los demás textos, sin texto fijo.
  const pastor = sanearDisenoOnerrd().campos.find((c) => c.id === 'pastor');
  assert.equal(textoDeCampoOnerrd(pastor, { pastor: 'Ana' }), 'ANA');
});

// Un texto puede enseñar el año del registro (un "2027" junto a REGISTRO):
// sale del mismo año de "Datos del registro", que es el que numera, y se
// guarda en los emitidos para volver a descargarlos igual.
test('un texto que muestra el año del registro sigue al año', () => {
  const [campo] = sanearDisenoOnerrd({
    campos: [{ id: 'texto8', tipo: 'anio', etiqueta: 'Año' }],
  }).campos;
  assert.equal(campo.tipo, 'anio');
  assert.equal(claveDeValorOnerrd(campo), 'anio');
  assert.equal(textoDeCampoOnerrd(campo, { anio: 2027 }), '2027');
  assert.equal(textoDeCampoOnerrd(campo, { anio: '2028', texto8: 'otro' }), '2028');
  assert.ok(seEscribeEnElLienzoOnerrd(campo));
  assert.equal(seEscribeEnElLienzoOnerrd({ tipo: 'numero' }), false);
});

// El degradado de las letras de CERTIFICADO / REGISTRO: borde → centro →
// borde. Las paradas y la línea son las mismas en la vista previa (CSS) y en
// el dibujo del PDF.
test('degradado: paradas, reflejo y saneado', () => {
  const [campo] = sanearDisenoOnerrd({
    campos: [
      {
        id: 'texto8',
        color: '#c28452',
        degradado: true,
        colorFin: '#fcc802',
        anguloDegradado: -90,
        inicioDegradado: 80,
        finDegradado: 20,
      },
    ],
  }).campos;
  assert.equal(campo.anguloDegradado, 270);
  assert.equal(campo.inicioDegradado, 80);
  assert.equal(campo.finDegradado, 80); // nunca antes que el inicio
  assert.equal(campo.reflejarDegradado, true);

  const reflejado = {
    color: '#000000',
    colorFin: '#FFFFFF',
    inicioDegradado: 0,
    finDegradado: 100,
  };
  assert.deepEqual(
    paradasDeDegradadoOnerrd(reflejado).map((p) => [p.color, p.posicion]),
    [
      ['#000000', 0],
      ['#FFFFFF', 50],
      ['#FFFFFF', 50],
      ['#000000', 100],
    ]
  );
  assert.deepEqual(
    paradasDeDegradadoOnerrd({ ...reflejado, reflejarDegradado: false }).map((p) => p.posicion),
    [0, 100]
  );
  assert.equal(
    cssDeDegradadoOnerrd({ ...reflejado, anguloDegradado: 90, reflejarDegradado: false }),
    'linear-gradient(90deg, #000000 0%, #FFFFFF 100%)'
  );
  const [sinDegradado] = sanearDisenoOnerrd({ campos: [{ id: 'pastor' }] }).campos.filter(
    (c) => c.id === 'pastor'
  );
  assert.equal(sinDegradado.degradado, false);
});

test('la línea del degradado es la de CSS', () => {
  // 90°: de izquierda a derecha, a media altura.
  const derecha = lineaDeDegradadoOnerrd(90, 100, 20);
  [
    [derecha.x1, 0],
    [derecha.y1, 10],
    [derecha.x2, 100],
    [derecha.y2, 10],
  ].forEach(([valor, esperado]) => assert.ok(Math.abs(valor - esperado) < 1e-9));
  // 180°: de arriba abajo.
  const abajo = lineaDeDegradadoOnerrd(180, 100, 20);
  assert.ok(
    Math.abs(abajo.x1 - 50) < 1e-9 && Math.abs(abajo.y1) < 1e-9 && Math.abs(abajo.y2 - 20) < 1e-9
  );
  // 45°: las esquinas caen en el 0 % y el 100 %.
  const diagonal = lineaDeDegradadoOnerrd(45, 100, 20);
  const largo = Math.hypot(diagonal.x2 - diagonal.x1, diagonal.y2 - diagonal.y1);
  assert.ok(Math.abs(largo - (100 + 20) * Math.SQRT1_2) < 1e-9);
});

// Un texto añadido guardaba lo escrito como dato de un certificado: no iba con
// el diseño y al recargar quedaba vacío ("[Texto nuevo]" en vez del 2027). El
// texto fijo lo guarda el diseño y sale igual en todos.
test('un texto fijo se guarda con el diseño y no depende de los datos', () => {
  const [campo] = sanearDisenoOnerrd({
    campos: [{ id: 'texto8', tipo: 'fijo', contenido: 'Sello 2027', etiqueta: 'Sello' }],
  }).campos;
  assert.equal(campo.tipo, 'fijo');
  assert.equal(campo.contenido, 'Sello 2027');
  assert.equal(textoDeCampoOnerrd(campo, {}), 'SELLO 2027');
  assert.equal(textoDeCampoOnerrd(campo, { texto8: 'otra cosa' }), 'SELLO 2027');
  assert.ok(seEscribeEnElLienzoOnerrd(campo));
  // Vacío no pinta nada (en el lienzo, su rótulo apagado).
  assert.equal(textoDeCampoOnerrd({ ...campo, contenido: '' }, {}), '');
});

// El año del registro es de fábrica: estaba en un texto añadido a mano y, al
// eliminarlo, el certificado se quedó sin año. Un diseño guardado antes lo
// recibe solo, junto a REGISTRO, con el degradado de las letras del título.
test('el año del registro está siempre en el diseño', () => {
  const anio = (d) => sanearDisenoOnerrd(d).campos.find((c) => c.id === 'anioRegistro');
  const guardadoAntes = anio({ campos: [{ id: 'iglesia', fuente: 'Oswald', peso: 400 }] });
  assert.ok(guardadoAntes);
  assert.equal(guardadoAntes.tipo, 'anio');
  assert.equal(guardadoAntes.visible, true);
  assert.equal(guardadoAntes.deFabrica, true);
  assert.equal(guardadoAntes.degradado, true);
  assert.equal(guardadoAntes.fuente, 'Anton');
  assert.equal(textoDeCampoOnerrd(guardadoAntes, { anio: 2027 }), '2027');
  // El ejemplo de fábrica manda sobre uno guardado antes.
  const iglesia = sanearDisenoOnerrd({
    campos: [{ id: 'iglesia', ejemplo: 'Asamblea de Dios' }],
  }).campos.find((c) => c.id === 'iglesia');
  assert.equal(iglesia.ejemplo, 'Del Libertador');
});

// El QR abre el certificado guardado: una página pública que lo enseña dentro
// de un contenedor con la fecha y hora de generación, con la clave de ESE
// certificado. Los números son correlativos; sin clave, cualquiera
// podría ir probando 2027-001, 2027-002… y bajarse todos.
test('el QR lleva a la página del certificado guardado con su propia clave', () => {
  const clave = crearClaveOnerrd();
  assert.ok(esClaveOnerrdValida(clave));
  assert.notEqual(clave, crearClaveOnerrd());
  assert.equal(
    urlDelCertificadoOnerrd('https://expedition.app/', '2027-004', clave),
    `https://expedition.app/certificados-onerrd/2027-004?c=${clave}`
  );
  // Sin clave (PDF de prueba o emitido antes del QR): al aviso, nunca al PDF.
  assert.equal(
    urlDelCertificadoOnerrd('https://expedition.app', '2027-004', ''),
    'https://expedition.app/certificados-onerrd/prueba'
  );
  assert.equal(esNumeroOnerrdValido('2027-004'), true);
  assert.equal(esNumeroOnerrdValido('../2027-004'), false);
  assert.equal(esClaveOnerrdValida('corta'), false);
  assert.equal(rutaPdfOnerrd('2027-004'), 'certificados-onerrd/2027-004.pdf');
  // La página pide el PDF guardado a la ruta que lo entrega, con la misma clave.
  assert.equal(urlDelPdfOnerrd('2027-004', clave), `/api/certificados-onerrd/2027-004?c=${clave}`);
  assert.equal(
    urlDelPdfOnerrd('2027-004', clave, { descargar: true }),
    `/api/certificados-onerrd/2027-004?c=${clave}&descargar=1`
  );
  assert.equal(urlDelPdfOnerrd('2027-004', ''), '');
});

// La fecha y hora de generación la enseña el contenedor que abre el QR (en
// hora de Santo Domingo aunque el equipo esté en otra zona); en el papel el QR
// va solo, sin el "Generado: …" que se pintaba debajo.
test('la fecha y hora de generación va en el contenedor, no bajo el QR', () => {
  assert.equal(formatearFechaHoraOnerrd('2026-10-07T14:32:00Z'), '07/10/2026 10:32 a. m.');
  assert.equal(formatearFechaHoraOnerrd('2026-10-07T23:05:00Z'), '07/10/2026 7:05 p. m.');
  assert.equal(formatearFechaHoraOnerrd('no es fecha'), '');
  // Un diseño guardado con la leyenda encendida ya no la conserva.
  assert.equal('mostrarFecha' in sanearDisenoOnerrd({ qr: { mostrarFecha: true } }).qr, false);
});

test('el QR está en el diseño, se mueve, cambia de tamaño y se puede ocultar', () => {
  const { qr } = sanearDisenoOnerrd();
  assert.equal(qr.visible, true);
  assert.equal(qr.color, '#000000');
  const guardado = sanearDisenoOnerrd({
    qr: { x: 10, y: 'NaN', ancho: 500, visible: false, color: 'azul' },
  }).qr;
  assert.equal(guardado.x, 10);
  assert.equal(guardado.y, 88); // roto → el de fábrica
  assert.equal(guardado.ancho, 100);
  assert.equal(guardado.visible, false);
  assert.equal(guardado.color, '#000000');
});

// Las firmas giran sobre su centro, igual en pantalla y en el PDF.
test('las firmas se giran y el giro se guarda acotado', () => {
  const [firma1, firma2] = sanearDisenoOnerrd({
    firmas: [
      { id: 'firma1', rotacion: 270 },
      { id: 'firma2', rotacion: 'roto' },
    ],
  }).firmas;
  assert.equal(firma1.rotacion, -90);
  assert.equal(firma2.rotacion, 0);
  assert.equal(acotarRotacionOnerrd(-185), 175);
  assert.equal(acotarRotacionOnerrd(12.34), 12.3);
  assert.equal(acotarRotacionOnerrd(180), 180);
});

// El certificado lleva el icono de la región del participante. Por ahora se
// elige en un desplegable con las cuatro regiones del padrón; el contenedor del
// icono se mueve y se cambia de tamaño, y eso se guarda con el diseño. Un
// diseño guardado antes de que existiera no lo pierde: sale en su sitio de
// fábrica.
test('el icono de la región: cuatro regiones y un contenedor que se mueve y se guarda', () => {
  assert.deepEqual(
    REGIONES_ONERRD.map((r) => r.nombre),
    ['Región Central', 'Región Norte', 'Región Sur', 'Región Este']
  );
  assert.equal(regionOnerrd('provisional'), null);
  assert.equal(idDocumentoIconoRegionOnerrd('sur'), 'region-sur');
  // Un id raro no se convierte en un documento cualquiera de la colección.
  assert.equal(idDocumentoIconoRegionOnerrd('../diseno'), '');

  const deAntes = sanearDisenoOnerrd({ campos: [] });
  assert.deepEqual(deAntes.iconoRegion, { ...ICONO_REGION_DE_FABRICA_ONERRD });

  const movido = sanearDisenoOnerrd({
    iconoRegion: { x: 12.345, y: 30, ancho: 9, visible: false },
  }).iconoRegion;
  assert.equal(movido.y, 30);
  assert.equal(movido.ancho, 9);
  assert.equal(movido.visible, false);
  // Guardado y vuelto a leer, queda igual.
  assert.deepEqual(sanearDisenoOnerrd({ iconoRegion: movido }).iconoRegion, movido);

  // Una posición rota vuelve a la de fábrica, no al centro de la hoja.
  const roto = sanearDisenoOnerrd({ iconoRegion: { x: 'no', y: null } }).iconoRegion;
  assert.equal(roto.x, ICONO_REGION_DE_FABRICA_ONERRD.x);
  assert.equal(roto.y, ICONO_REGION_DE_FABRICA_ONERRD.y);
});

// El QR se imprime: tiene que abrir la aplicación publicada del ambiente donde
// está el certificado, nunca `localhost` (desde local se emitía uno que en el
// móvil no abría nada). Manda el proyecto de Firebase de los datos.
test('el QR lleva a la dirección publicada del ambiente, también si se emite en local', () => {
  const local = 'http://localhost:3032';
  assert.equal(
    direccionPublica({ proyecto: 'systexploradores-dev', origenActual: local }),
    'https://expedition-dev--systexploradores-dev.us-central1.hosted.app'
  );
  assert.equal(
    direccionPublica({ proyecto: 'systexploradores-qa', origenActual: local }),
    'https://expedition-qa--systexploradores-qa.us-central1.hosted.app'
  );
  assert.equal(
    direccionPublica({ proyecto: 'systexploradores', origenActual: local }),
    'https://explora--systexploradores.us-central1.hosted.app'
  );
  // Un dominio propio configurado manda; uno local configurado, no.
  assert.equal(
    direccionPublica({ configurada: 'https://explora.org/', proyecto: 'systexploradores' }),
    'https://explora.org'
  );
  assert.equal(
    direccionPublica({ configurada: 'http://localhost:3000', proyecto: 'systexploradores' }),
    DIRECCIONES_PUBLICAS.systexploradores
  );
  // Proyecto desconocido: la pestaña si es pública; si es local, nada.
  assert.equal(
    direccionPublica({ proyecto: 'otro', origenActual: 'https://x.app' }),
    'https://x.app'
  );
  assert.equal(direccionPublica({ proyecto: 'otro', origenActual: local }), '');
});

// Los originales de la plantilla (.svg) y de las firmas van a Storage junto a
// los PDF, con rutas fijas: cada plantilla con su fecha y hora (no se pisan) y
// cada firma por su id. Un nombre raro no saca el archivo de su carpeta.
test('las rutas de los originales: plantillas con fecha y hora, firmas por id', () => {
  assert.equal(
    rutaPlantillaOnerrd(
      'Plantilla-Certificado de Renovación anual errd.svg',
      '2026-10-07T19:30:05Z'
    ),
    'certificados-onerrd/plantillas/2026-10-07_15-30-05_Plantilla-Certificado-de-Renovacion-anual-errd.svg'
  );
  assert.equal(
    rutaPlantillaOnerrd('../../x.svg', '2026-10-07T19:30:05Z'),
    'certificados-onerrd/plantillas/2026-10-07_15-30-05_x.svg'
  );
  assert.equal(
    rutaFirmaOnerrd('firma-1791380000000', 'image/png'),
    'certificados-onerrd/firmas/firma-1791380000000.png'
  );
  assert.equal(rutaFirmaOnerrd('firma-1791380000000', 'image/jpeg').endsWith('.jpg'), true);
  assert.equal(rutaFirmaOnerrd('firma-1791380000000', 'application/pdf'), '');
  assert.equal(rutaFirmaOnerrd('../fondo', 'image/png'), '');
});

// Varias imágenes en el certificado ("Subir imagen" suma, no reemplaza; o se
// sueltan encima del lienzo). El diseño guarda solo su sitio, tamaño y giro;
// cada imagen vive en su documento. Un diseño solo acepta las suyas.
test('el certificado admite varias imágenes subidas, cada una con su sitio y giro', () => {
  const id = crearIdImagenSubidaOnerrd('certificado', 1791380000000);
  assert.equal(id, 'certificado-imagen-1791380000000');
  assert.equal(crearIdImagenSubidaOnerrd('factura', 1).startsWith('factura-imagen-'), true);
  assert.equal(esIdImagenSubidaOnerrd(id), true);
  assert.equal(esIdImagenSubidaOnerrd('fondo'), false);

  const otra = crearIdImagenSubidaOnerrd('certificado', 1791380000001);
  const { imagenes } = sanearDisenoOnerrd({
    imagenes: [
      { id, x: 30, y: 40, ancho: 15, rotacion: 450 },
      { id: otra, visible: false },
      { id },
      { id: 'factura-imagen-1791380000002' },
    ],
  });
  assert.deepEqual(
    imagenes.map((i) => [i.id, i.x, i.y, i.ancho, i.rotacion, i.visible]),
    [
      [id, 30, 40, 15, 90, true],
      [otra, 50, 50, 20, 0, false],
    ]
  );
  assert.deepEqual(sanearDisenoOnerrd().imagenes, []);
});

// "Fecha y hora de emisión": siempre la de la emisión, en UTC-4 (Santo
// Domingo), con el formato del bloque de firma digital.
test('la fecha y hora de emisión sale en UTC-4', () => {
  assert.equal(formatearEmisionOnerrd('2026-10-07T14:05:00Z'), '07/10/2026 UTC-4 10:05 A.M.');
  assert.equal(formatearEmisionOnerrd('2026-10-07T23:30:00Z'), '07/10/2026 UTC-4 7:30 P.M.');
  const campo = sanearCampoOnerrd({ id: 'texto9', tipo: 'emision', mayusculas: true });
  assert.equal(campo.tipo, 'emision');
  assert.equal(
    textoDeCampoOnerrd(campo, { emitidoEnIso: '2026-10-07T14:05:00Z' }),
    '07/10/2026 UTC-4 10:05 A.M.'
  );
});

// Eliminar un texto lo deja en la papelera del diseño (se guarda con él) y
// se restaura en su sitio; con otro id si entretanto se usó el suyo.
test('los textos eliminados van a la papelera y se restauran', () => {
  const diseno = sanearDisenoOnerrd({
    campos: [{ id: 'texto9', tipo: 'fijo', etiqueta: 'Firma digital', contenido: 'X', x: 30 }],
  });
  const sin = quitarCamposAPapeleraOnerrd(diseno, ['texto9'], '2026-10-07T14:00:00Z');
  assert.equal(
    sin.campos.some((c) => c.id === 'texto9'),
    false
  );
  assert.equal(sin.papelera[0].campo.etiqueta, 'Firma digital');
  // Se guarda con el diseño.
  assert.equal(sanearDisenoOnerrd(sin).papelera.length, 1);
  const devuelto = restaurarDePapeleraOnerrd(sin, 0);
  const campo = devuelto.campos.find((c) => c.etiqueta === 'Firma digital');
  assert.equal(campo.x, 30);
  assert.equal(devuelto.papelera.length, 0);
});

// Una fecha escrita a mano como texto fijo se quedaba igual en todos: se
// convierte sola en la fecha y hora de emisión.
test('una fecha y hora escrita a mano pasa a ser la de emisión', () => {
  const campo = sanearCampoOnerrd({
    id: 'texto5',
    tipo: 'fijo',
    contenido: '07/10/2026 UTC-4 10:05 A.M.',
  });
  assert.equal(campo.tipo, 'emision');
  assert.equal(
    textoDeCampoOnerrd(campo, { emitidoEnIso: '2026-12-01T18:00:00Z' }),
    '01/12/2026 UTC-4 2:00 P.M.'
  );
  assert.equal(sanearCampoOnerrd({ id: 't', tipo: 'fijo', contenido: 'Firmado' }).tipo, 'fijo');
});
