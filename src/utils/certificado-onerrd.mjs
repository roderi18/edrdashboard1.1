// ----------------------------------------------------------------------
// CERTIFICADO ONERRD (Renovación anual del registro de destacamentos).
//
// Una plantilla SVG de fondo y, encima, lo que cambia en cada certificado:
// textos con los datos del registro, una imagen y dos firmas. Todo se coloca
// arrastrando en la pestaña "ONERRD" de Certificados y se guarda como diseño.
//
// Aquí vive SOLO lo que no depende del navegador ni de Firebase (numeración,
// saneado y medidas), para que la misma regla la usen la pantalla, el PDF y
// los tests: `tests/admin/certificado-onerrd.test.mjs`.
//
// Las posiciones van en PORCENTAJE de la página (x, y = centro del elemento;
// `ancho` = % del ancho de la página). Así el diseño no depende del tamaño de
// la vista previa ni de la resolución con que se pinte el fondo.
// ----------------------------------------------------------------------

// Carta apaisada en puntos: el tamaño de la plantilla de 2027 (viewBox
// 792 x 612). Si el SVG trae otro viewBox, manda el del SVG.
export const PAGINA_ONERRD_POR_DEFECTO = Object.freeze({ ancho: 792, alto: 612 });

// Interlineado de los textos, el mismo en la vista previa y en el PDF: el
// centro vertical del elemento es el centro de su primera línea.
export const INTERLINEADO_ONERRD = 1.2;

// `ascensoPdf`: la altura de la letra sobre su línea base, en tamaños de
// letra, tal como la usa el PDF (react-pdf): 0,9 fijo en las tres estándar y
// el `ascent` del archivo (tabla hhea) en las de `public/fuentes`. Si se
// cambia un archivo de fuente, su test avisa de que este número ya no vale.
export const FUENTES_ONERRD = Object.freeze([
  {
    value: 'Helvetica',
    ascensoPdf: 0.9,
    label: 'Helvetica',
    css: 'Helvetica, Arial, sans-serif',
    cursiva: true,
    negrita: true,
  },
  {
    value: 'Times',
    ascensoPdf: 0.9,
    label: 'Times',
    css: '"Times New Roman", Times, serif',
    cursiva: true,
    negrita: true,
  },
  {
    value: 'Courier',
    ascensoPdf: 0.9,
    label: 'Courier',
    css: '"Courier New", Courier, monospace',
    cursiva: true,
    negrita: true,
  },
  // Las de `public/fuentes`: el PDF las registra desde ahí y la vista previa
  // con la misma @font-face, así lo que se ve es lo que sale. Sin cursiva.
  {
    value: 'Roboto',
    ascensoPdf: 1900 / 2048,
    label: 'Roboto',
    css: 'OnerrdRoboto, Roboto, Arial, sans-serif',
    cursiva: false,
    negrita: true,
  },
  // La de la plantilla de 2027 (rótulos, fecha y registro): la letra de todos
  // los textos menos el número del laurel. La de Google Fonts
  // (`Oswald:wght@200..700`); el PDF no puede leer su hoja de estilos, así que
  // cada grueso es un archivo fijo sacado de esa variable.
  {
    value: 'Oswald',
    ascensoPdf: 1.193,
    label: 'Oswald',
    css: 'Oswald, OnerrdOswald, "Arial Narrow", sans-serif',
    cursiva: false,
    negrita: true,
    pesos: [200, 300, 400, 500, 600, 700],
  },
  // La del número del laurel. La plantilla de 2027 usa "Bridge", de pago y de
  // la que el PDF original solo trae el 0 y el 1; Anton (OFL) es la gratuita
  // más parecida. Solo tiene un grueso: una negrita la engordaba el navegador
  // y el PDF no, y la vista previa dejaba de ser lo que sale.
  {
    value: 'Anton',
    ascensoPdf: 2409 / 2048,
    label: 'Anton',
    css: 'OnerrdAnton, Anton, Impact, sans-serif',
    cursiva: false,
    negrita: false,
  },
]);

// Gruesos con nombre (los de Google Fonts) y el archivo de cada uno.
export const PESOS_ONERRD = Object.freeze({
  200: { nombre: 'Extra ligera', archivo: 'ExtraLight' },
  300: { nombre: 'Ligera', archivo: 'Light' },
  400: { nombre: 'Normal', archivo: 'Regular' },
  500: { nombre: 'Media', archivo: 'Medium' },
  600: { nombre: 'Seminegrita', archivo: 'SemiBold' },
  700: { nombre: 'Negrita', archivo: 'Bold' },
});

// El grueso con que se pinta un campo (en pantalla, al medir y en el PDF). Uno
// en edición puede no traer `peso` todavía: vale su negrita.
export const pesoDeCampoOnerrd = (campo) =>
  Number(campo?.peso) > 0 ? Number(campo.peso) : campo?.negrita ? 700 : 400;

// La letra de los textos nuevos y de los de fábrica sin otra.
export const FUENTE_ONERRD_POR_DEFECTO = 'Oswald';

export const ALINEACIONES_ONERRD = Object.freeze(['left', 'center', 'right']);

export const TIPOS_DE_CAMPO_ONERRD = Object.freeze({
  numero: 'numero', // el incremental AÑO-001: lo pone el sistema al emitir
  fecha: 'fecha',
  texto: 'texto',
  anio: 'anio', // el año del registro: el mismo de "Datos del registro"
  // Lo escrito se guarda CON EL DISEÑO y sale igual en todos los certificados.
  // Un texto añadido guardaba lo escrito como dato de un certificado: no se
  // guardaba con el diseño y al recargar la página quedaba vacío.
  fijo: 'fijo',
});

// Dónde se guarda lo que se escribe en un campo. El año es uno solo para todo
// el certificado (y manda en la numeración): escribirlo en el lienzo cambia
// el de "Datos del registro".
export const claveDeValorOnerrd = (campo) => (campo.tipo === 'anio' ? 'anio' : campo.id);

// Se escriben en su caja del lienzo (los demás los pone el sistema o el
// calendario).
export const seEscribeEnElLienzoOnerrd = (campo) =>
  campo.tipo === 'texto' || campo.tipo === 'anio' || campo.tipo === 'fijo';

// Degradado: borde y centro de las letras de CERTIFICADO / REGISTRO.
export const DEGRADADO_INICIAL_ONERRD = Object.freeze({ inicio: '#C28452', fin: '#FCC802' });

// Los datos del registro que trae el certificado de 2027, colocados en los
// huecos de su plantilla (medidos sobre ella): el número dentro del laurel,
// IGLESIA / PASTOR / COORDINADOR a la derecha de su rótulo, el registro en la
// casilla "REGISTRO No." y las firmas sobre sus líneas. Son un punto de
// partida: se mueven en la pantalla y se guardan.
const AZUL_DE_LA_PLANTILLA = '#1B2F5E';

export const CAMPOS_DE_FABRICA_ONERRD = Object.freeze(
  [
    {
      id: 'numeroRegistro',
      tipo: 'numero',
      etiqueta: 'Registro No.',
      ejemplo: '',
      x: 90.5,
      y: 71,
      ancho: 11,
      tamano: 12,
      negrita: true,
    },
    {
      id: 'fecha',
      tipo: 'fecha',
      etiqueta: 'Fecha',
      ejemplo: '',
      x: 90.5,
      y: 76.5,
      ancho: 11,
      tamano: 10,
    },
    {
      id: 'numeroDestacamento',
      tipo: 'texto',
      etiqueta: 'Número de destacamento',
      ejemplo: '001',
      x: 22.6,
      y: 52,
      ancho: 9,
      tamano: 40,
      // Como el "001" de la plantilla: amarillo con contorno granate.
      fuente: 'Anton',
      color: '#EBBB0B',
      contorno: '#9A2222',
      grosorContorno: 2.2,
    },
    {
      // El año, junto a REGISTRO y de su misma altura: Anton (la más parecida
      // a la letra del título) con el degradado y el contorno de CERTIFICADO /
      // REGISTRO. De fábrica para que no se pierda: solo se puede ocultar.
      id: 'anioRegistro',
      tipo: 'anio',
      etiqueta: 'Año del registro',
      ejemplo: '',
      // Como en la plantilla PDF original: 21 pt a la derecha de REGISTRO y de
      // su misma altura (medido sobre el SVG de la plantilla).
      x: 68.6,
      y: 34.15,
      ancho: 18,
      tamano: 56,
      fuente: 'Anton',
      alineacion: 'left',
      color: '#C28452',
      colorFin: '#FCC802',
      degradado: true,
      reflejarDegradado: true,
      contorno: '#9A2222',
      grosorContorno: 2.5,
    },
    {
      id: 'nombreDestacamento',
      tipo: 'texto',
      etiqueta: 'Nombre del destacamento',
      ejemplo: 'Halcones del Este',
      x: 22.6,
      y: 62.6,
      ancho: 16,
      tamano: 8,
    },
    {
      id: 'iglesia',
      tipo: 'texto',
      etiqueta: 'Iglesia',
      ejemplo: 'Del Libertador',
      // Todas son Asambleas de Dios: se escribe solo el nombre y va entre las
      // comillas, ASAMBLEA DE DIOS "DEL LIBERTADOR".
      prefijo: 'Asamblea de Dios “',
      sufijo: '”',
      x: 61,
      y: 50.6,
      ancho: 45.5,
      tamano: 13,
      // Como "ASAMBLEA DE DIOS" en la plantilla: las letras abiertas.
      espaciado: 2,
      alineacion: 'left',
    },
    {
      id: 'pastor',
      tipo: 'texto',
      etiqueta: 'Pastor',
      ejemplo: 'Nombre del pastor',
      x: 61,
      y: 54.3,
      ancho: 45.5,
      tamano: 13,
      alineacion: 'left',
    },
    {
      id: 'coordinador',
      tipo: 'texto',
      etiqueta: 'Coordinador',
      ejemplo: 'Nombre del coordinador',
      x: 64.8,
      y: 57.7,
      ancho: 38.5,
      tamano: 13,
      alineacion: 'left',
    },
  ].map((campo) => ({ color: AZUL_DE_LA_PLANTILLA, fuente: FUENTE_ONERRD_POR_DEFECTO, ...campo }))
);

export const FIRMAS_DE_FABRICA_ONERRD = Object.freeze([
  { id: 'firma1', etiqueta: 'Firma 1', idFirma: '', x: 20.5, y: 85, ancho: 18 },
  { id: 'firma2', etiqueta: 'Firma 2', idFirma: '', x: 82.5, y: 85, ancho: 18 },
]);

// Encima del laurel, donde va el logo de la iglesia.
export const IMAGEN_DE_FABRICA_ONERRD = Object.freeze({
  x: 22.6,
  y: 45.5,
  ancho: 5,
  visible: true,
});

// Icono de la región del participante: al otro lado del laurel, frente al
// logo de la iglesia. Se mueve y se cambia de tamaño como la imagen.
export const ICONO_REGION_DE_FABRICA_ONERRD = Object.freeze({
  x: 77.4,
  y: 45.5,
  ancho: 5,
  visible: true,
});

// Las cuatro regiones del padrón (API .NET: idRegion 3, 18, 12 y 13). Por ahora
// se eligen a mano en un desplegable; "Provisional" no es una región de verdad
// y no lleva icono. El icono de cada una se sube una vez y se guarda en
// `certificadosOnerrd/region-{id}`.
export const REGIONES_ONERRD = Object.freeze([
  Object.freeze({ id: 'central', nombre: 'Región Central', idRegion: 3 }),
  Object.freeze({ id: 'norte', nombre: 'Región Norte', idRegion: 18 }),
  Object.freeze({ id: 'sur', nombre: 'Región Sur', idRegion: 12 }),
  Object.freeze({ id: 'este', nombre: 'Región Este', idRegion: 13 }),
]);

export const regionOnerrd = (id) => REGIONES_ONERRD.find((region) => region.id === id) || null;

export const idDocumentoIconoRegionOnerrd = (id) => (regionOnerrd(id) ? `region-${id}` : '');

// Código QR: abajo a la derecha, donde la plantilla tiene sitio libre. Negro
// sobre blanco de entrada: cualquier móvil lo lee (un color claro, no).
export const QR_DE_FABRICA_ONERRD = Object.freeze({
  x: 93.5,
  y: 88,
  ancho: 8,
  visible: true,
  color: '#000000',
});

// Espaciado entre letras en pt: por debajo de 0 las junta (un número de
// letra condensada se lee mejor apretado), sin llegar a montarlas.
export const ESPACIADO_MINIMO_ONERRD = -5;
export const ESPACIADO_MAXIMO_ONERRD = 20;

const GROSOR_DE_CONTORNO_INICIAL = 1;

const TAMANO_MINIMO = 4;
const TAMANO_MAXIMO = 160;
const ANCHO_MINIMO = 2;

// `null` y '' no son 0: Number() los convierte en 0 y un elemento sin
// posición acababa en la esquina de arriba en vez de en su sitio.
const numero = (valor, porDefecto) => {
  if (valor === null || valor === '') return porDefecto;
  const n = Number(valor);
  return Number.isFinite(n) ? n : porDefecto;
};

const acotar = (valor, minimo, maximo) => Math.min(maximo, Math.max(minimo, valor));

const redondear = (valor) => Math.round(valor * 100) / 100;

// Un centro puede quedar fuera de la hoja (un elemento a medio salir), pero no
// perderse: más allá de esto no hay forma de volver a agarrarlo con el ratón.
export const acotarPosicion = (valor) => redondear(acotar(numero(valor, 50), -5, 105));

// Sin caracteres de control (un salto de línea pegado desde Word partía el
// texto en el PDF).
const textoLimpio = (valor, maximo = 200) =>
  Array.from(String(valor ?? ''), (letra) => {
    const codigo = letra.charCodeAt(0);
    return codigo < 32 || codigo === 127 ? ' ' : letra;
  })
    .join('')
    .slice(0, maximo);

const colorHex = (valor, porDefecto = '#111111') =>
  /^#[0-9a-f]{6}$/i.test(String(valor ?? '')) ? String(valor).toUpperCase() : porDefecto;

export const crearIdDeCampo = (existentes = []) => {
  const usados = new Set(existentes.map((campo) => campo.id));
  let indice = existentes.length + 1;
  while (usados.has(`texto${indice}`)) indice += 1;
  return `texto${indice}`;
};

// ----------------------------------------------------------------------
// SANEADO: lo que se guarda y lo que se lee pasa por aquí. Un campo roto no
// tumba el diseño entero: vuelve a su valor por defecto.
// ----------------------------------------------------------------------

// Lo que da el aspecto de letra (no el sitio ni el tamaño).
const ESTILO_DE_LETRA = ['fuente', 'color', 'negrita', 'cursiva', 'contorno', 'grosorContorno'];

export const sanearCampoOnerrd = (entrada = {}) => {
  const fabrica = CAMPOS_DE_FABRICA_ONERRD.find((item) => item.id === entrada.id);
  // Un diseño guardado antes de que hubiera contorno no trae la clave: el
  // campo de fábrica que ahora lo lleva (el número del laurel) toma su letra
  // nueva y conserva sitio y tamaño. Uno guardado después la trae siempre
  // (vacía si se quitó), y entonces manda lo guardado.
  const conContorno =
    fabrica?.contorno && entrada.contorno === undefined
      ? {
          ...entrada,
          ...Object.fromEntries(ESTILO_DE_LETRA.map((clave) => [clave, fabrica[clave]])),
        }
      : entrada;
  // Antes del grueso (`peso`) la letra por defecto era Helvetica; desde
  // entonces es Oswald, la de la plantilla. Un texto guardado entonces con
  // Helvetica la tenía por no elegir: pasa a Oswald, con su negrita.
  const campo =
    entrada.peso === undefined && (!conContorno.fuente || conContorno.fuente === 'Helvetica')
      ? { ...conContorno, fuente: FUENTE_ONERRD_POR_DEFECTO }
      : conContorno;
  const tipo = Object.values(TIPOS_DE_CAMPO_ONERRD).includes(campo.tipo)
    ? campo.tipo
    : fabrica?.tipo || 'texto';
  const fuente = FUENTES_ONERRD.some((item) => item.value === campo.fuente)
    ? campo.fuente
    : fabrica?.fuente || FUENTE_ONERRD_POR_DEFECTO;
  const {
    cursiva: admiteCursiva,
    negrita: admiteNegrita,
    pesos,
  } = FUENTES_ONERRD.find((item) => item.value === fuente);
  const conNegrita = Boolean(admiteNegrita && (campo.negrita ?? fabrica?.negrita ?? false));
  // Con varios gruesos manda el elegido (o el de su negrita); con solo normal y
  // negrita, el botón N.
  const peso =
    pesos && pesos.includes(Number(campo.peso)) ? Number(campo.peso) : conNegrita ? 700 : 400;
  const contorno = colorHex(campo.contorno, '');

  return {
    id:
      textoLimpio(campo.id || fabrica?.id || 'texto1', 60).replace(/[^A-Za-z0-9_-]/g, '') ||
      'texto1',
    tipo,
    etiqueta: textoLimpio(campo.etiqueta ?? fabrica?.etiqueta ?? 'Texto', 80) || 'Texto',
    // El ejemplo de un campo de fábrica es siempre el de fábrica: ya no se
    // edita, y uno guardado antes ("Asamblea de Dios") se leía como
    // ASAMBLEA DE DIOS “ASAMBLEA DE DIOS” en el formulario.
    ejemplo: textoLimpio(fabrica ? fabrica.ejemplo : (campo.ejemplo ?? ''), 200),
    deFabrica: Boolean(fabrica),
    visible: campo.visible !== false,
    x: acotarPosicion(campo.x ?? fabrica?.x ?? 50),
    y: acotarPosicion(campo.y ?? fabrica?.y ?? 50),
    ancho: redondear(acotar(numero(campo.ancho, fabrica?.ancho ?? 40), ANCHO_MINIMO, 100)),
    tamano: redondear(
      acotar(numero(campo.tamano, fabrica?.tamano ?? 14), TAMANO_MINIMO, TAMANO_MAXIMO)
    ),
    fuente,
    peso,
    negrita: peso >= 600,
    cursiva: Boolean(admiteCursiva && campo.cursiva),
    color: colorHex(campo.color, fabrica?.color || '#111111'),
    // Contorno por fuera de la letra: color ('' = sin contorno) y grueso en pt.
    contorno,
    // Relleno en degradado: del `color` al `colorFin`, con su ángulo (como
    // en CSS: 90 = de izquierda a derecha), dónde empieza y acaba la mezcla
    // (% del texto) y si se refleja (borde → centro → borde).
    degradado: Boolean(campo.degradado),
    colorFin: colorHex(campo.colorFin, DEGRADADO_INICIAL_ONERRD.fin),
    anguloDegradado: redondear(((numero(campo.anguloDegradado, 90) % 360) + 360) % 360),
    inicioDegradado: redondear(acotar(numero(campo.inicioDegradado, 0), 0, 100)),
    finDegradado: redondear(
      acotar(numero(campo.finDegradado, 100), acotar(numero(campo.inicioDegradado, 0), 0, 100), 100)
    ),
    reflejarDegradado: campo.reflejarDegradado !== false,
    grosorContorno: contorno
      ? redondear(acotar(numero(campo.grosorContorno, GROSOR_DE_CONTORNO_INICIAL), 0, 20))
      : 0,
    alineacion: ALINEACIONES_ONERRD.includes(campo.alineacion)
      ? campo.alineacion
      : fabrica?.alineacion || 'center',
    mayusculas: campo.mayusculas !== false,
    // Texto fijo alrededor del dato (vacío = ninguno). Un diseño guardado sin
    // la clave toma el de fábrica.
    // Lo que dice un texto fijo (los demás lo toman de los datos del registro).
    contenido: textoLimpio(campo.contenido ?? '', 200),
    prefijo: textoLimpio(campo.prefijo ?? fabrica?.prefijo ?? '', 80),
    sufijo: textoLimpio(campo.sufijo ?? fabrica?.sufijo ?? '', 80),
    espaciado: redondear(
      acotar(
        numero(campo.espaciado, fabrica?.espaciado ?? 0),
        ESPACIADO_MINIMO_ONERRD,
        ESPACIADO_MAXIMO_ONERRD
      )
    ),
    // Un nombre de iglesia largo se encoge hasta caber en su caja en vez de
    // partirse en dos líneas encima del diseño.
    ajustarAlAncho: campo.ajustarAlAncho !== false,
  };
};

// Una posición rota vuelve a la de fábrica, no al centro de la hoja (donde
// una firma o el QR caían encima del sello).
const sanearElementoImagen = (elemento = {}, fabrica = {}) => ({
  x: acotarPosicion(numero(elemento?.x, fabrica.x)),
  y: acotarPosicion(numero(elemento?.y, fabrica.y)),
  ancho: redondear(acotar(numero(elemento.ancho, fabrica.ancho), ANCHO_MINIMO, 100)),
});

export const sanearDisenoOnerrd = (diseno = {}) => {
  const camposGuardados = Array.isArray(diseno?.campos) ? diseno.campos : null;
  const campos = (camposGuardados || CAMPOS_DE_FABRICA_ONERRD).map(sanearCampoOnerrd);

  // Los de fábrica siempre están (se pueden ocultar, no perder), y nunca hay
  // dos campos con el mismo id: el segundo pisaría los datos del primero.
  const vistos = new Set();
  const unicos = campos.filter((campo) => {
    if (vistos.has(campo.id)) return false;
    vistos.add(campo.id);
    return true;
  });
  CAMPOS_DE_FABRICA_ONERRD.forEach((fabrica) => {
    if (!vistos.has(fabrica.id)) unicos.push(sanearCampoOnerrd(fabrica));
  });

  const firmasGuardadas = Array.isArray(diseno?.firmas) ? diseno.firmas : [];
  const firmas = FIRMAS_DE_FABRICA_ONERRD.map((fabrica) => {
    const guardada = firmasGuardadas.find((item) => item?.id === fabrica.id) || {};
    return {
      id: fabrica.id,
      etiqueta: textoLimpio(guardada.etiqueta ?? fabrica.etiqueta, 60) || fabrica.etiqueta,
      idFirma: textoLimpio(guardada.idFirma ?? '', 80),
      ...sanearElementoImagen(guardada, fabrica),
      // Giro en grados alrededor del centro (en pantalla y en el PDF).
      rotacion: acotarRotacionOnerrd(guardada.rotacion),
    };
  });

  return {
    campos: unicos,
    firmas,
    imagen: {
      ...sanearElementoImagen(diseno?.imagen, IMAGEN_DE_FABRICA_ONERRD),
      visible: diseno?.imagen?.visible !== false,
    },
    iconoRegion: {
      ...sanearElementoImagen(diseno?.iconoRegion, ICONO_REGION_DE_FABRICA_ONERRD),
      visible: diseno?.iconoRegion?.visible !== false,
    },
    qr: {
      ...sanearElementoImagen(diseno?.qr, QR_DE_FABRICA_ONERRD),
      visible: diseno?.qr?.visible !== false,
      color: colorHex(diseno?.qr?.color, QR_DE_FABRICA_ONERRD.color),
    },
  };
};

// Un giro en (-180, 180], redondeado a décimas: 270 es -90, y un número roto, 0.
export const acotarRotacionOnerrd = (valor) => {
  const n = ((numero(valor, 0) % 360) + 360) % 360;
  return Math.round((n > 180 ? n - 360 : n) * 10) / 10;
};

// ----------------------------------------------------------------------
// NUMERACIÓN: AÑO-001, AÑO-002… Un contador por año de registro. Un número
// emitido no se vuelve a usar nunca (ni si el PDF falla después): los
// certificados ya entregados lo llevan impreso.
// ----------------------------------------------------------------------

export const formatearNumeroOnerrd = (anio, secuencia) => {
  const a = Math.trunc(numero(anio, NaN));
  const s = Math.trunc(numero(secuencia, NaN));
  if (!Number.isFinite(a) || !Number.isFinite(s) || s < 1) return '';
  return `${a}-${String(s).padStart(3, '0')}`;
};

export const siguienteSecuenciaOnerrd = (ultimo) => Math.max(0, Math.trunc(numero(ultimo, 0))) + 1;

export const idContadorOnerrd = (anio) => `contador-${Math.trunc(numero(anio, 0))}`;

export const esAnioDeRegistroValido = (anio) => {
  const a = Number(anio);
  return Number.isInteger(a) && a >= 2000 && a <= 2200;
};

// El registro se renueva para el año que viene: el certificado de 2027 se
// emitió en octubre de 2026. De septiembre en adelante se propone el próximo.
export const anioDeRegistroPropuesto = (hoy = new Date()) =>
  hoy.getMonth() >= 8 ? hoy.getFullYear() + 1 : hoy.getFullYear();

// ----------------------------------------------------------------------
// TEXTO Y MEDIDAS, iguales en la vista previa y en el PDF.
// ----------------------------------------------------------------------

const ZONA_HORARIA_ONERRD = 'America/Santo_Domingo';

// 07/10/2026 10:32 a. m. en hora de Santo Domingo (dé igual la del equipo).
export const formatearFechaHoraOnerrd = (valor) => {
  const fecha = valor instanceof Date ? valor : new Date(valor);
  if (Number.isNaN(fecha.getTime())) return '';
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: ZONA_HORARIA_ONERRD,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
      .formatToParts(fecha)
      .map(({ type, value }) => [type, value])
  );
  const meridiano = partes.dayPeriod?.toUpperCase() === 'PM' ? 'p. m.' : 'a. m.';
  return `${partes.day}/${partes.month}/${partes.year} ${partes.hour}:${partes.minute} ${meridiano}`;
};

// ----------------------------------------------------------------------
// CÓDIGO QR. Abre el certificado guardado: al emitir, el PDF se guarda en
// Storage y el QR lleva la dirección de la página pública que lo enseña dentro
// de un contenedor con la fecha y hora de generación
// (`/certificados-onerrd/AAAA-NNN?c=CLAVE`); el PDF lo entrega
// `/api/certificados-onerrd/AAAA-NNN?c=CLAVE`. La clave es aleatoria y de
// cada certificado: los números son correlativos y, sin ella, cualquiera
// podría ir probando 2027-001, 2027-002… y bajarse todos.
// En el papel el QR va solo, sin texto: la fecha y hora de generación la
// enseña el contenedor que abre.
// ----------------------------------------------------------------------

export const CARPETA_PDF_ONERRD = 'certificados-onerrd';

export const rutaPdfOnerrd = (numeroRegistro) => `${CARPETA_PDF_ONERRD}/${numeroRegistro}.pdf`;

export const esNumeroOnerrdValido = (valor) => /^\d{4}-\d{3,6}$/.test(String(valor ?? ''));

export const esClaveOnerrdValida = (valor) => /^[A-Za-z0-9_-]{24,64}$/.test(String(valor ?? ''));

// 32 caracteres aleatorios (24 bytes): imposible de adivinar.
export const crearClaveOnerrd = () => {
  const bytes = new Uint8Array(24);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 32);
};

// Lo que lleva el QR. Sin número o sin clave (un PDF de prueba, o un
// certificado emitido antes de que existiera el QR) va a la página que dice
// que ese certificado no se puede consultar.
export const RUTA_PUBLICA_ONERRD = '/certificados-onerrd';

export const urlDelCertificadoOnerrd = (origen, numeroRegistro, clave) => {
  const base = `${String(origen || '').replace(/\/+$/, '')}${RUTA_PUBLICA_ONERRD}`;
  return esNumeroOnerrdValido(numeroRegistro) && esClaveOnerrdValida(clave)
    ? `${base}/${numeroRegistro}?c=${clave}`
    : `${base}/prueba`;
};

// El PDF guardado, que la página pide (y descarga). Solo con número y clave
// válidos: sin ellos no hay PDF que pedir.
export const urlDelPdfOnerrd = (numeroRegistro, clave, { descargar = false } = {}) =>
  esNumeroOnerrdValido(numeroRegistro) && esClaveOnerrdValida(clave)
    ? `/api/certificados-onerrd/${numeroRegistro}?c=${clave}${descargar ? '&descargar=1' : ''}`
    : '';

export const formatearFechaOnerrd = (valor) => {
  if (!valor) return '';
  const fecha = valor instanceof Date ? valor : new Date(valor);
  if (Number.isNaN(fecha.getTime())) return '';
  const dd = String(fecha.getDate()).padStart(2, '0');
  const mm = String(fecha.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${fecha.getFullYear()}`;
};

// Lo que se pinta de un campo con los valores del registro. Sin valor, nada
// (el ejemplo es solo el `placeholder` del formulario).
export const textoDeCampoOnerrd = (campo, valores = {}) => {
  let texto = '';
  if (campo.tipo === 'numero') texto = valores.numeroRegistro || '';
  else if (campo.tipo === 'fecha') texto = formatearFechaOnerrd(valores.fecha);
  else if (campo.tipo === 'fijo') texto = conTextoFijoOnerrd(campo, (campo.contenido || '').trim());
  else texto = conTextoFijoOnerrd(campo, String(valores[claveDeValorOnerrd(campo)] ?? '').trim());

  return campo.mayusculas ? texto.toLocaleUpperCase('es') : texto;
};

// Para comparar sin mayúsculas, tildes, comillas ni espacios de más.
const comparable = (texto) =>
  String(texto)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/["“”«»'‘’]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

// El texto fijo va SIEMPRE (también sin dato: ASAMBLEA DE DIOS “”), salvo si
// quien escribió ya lo puso: "Asamblea de Dios Del Libertador" no se convierte
// en ASAMBLEA DE DIOS “ASAMBLEA DE DIOS DEL LIBERTADOR”. Pasa con lo que se
// escribía antes de que existiera, y con los certificados ya emitidos.
export const conTextoFijoOnerrd = (campo, valor) => {
  const prefijo = campo.prefijo || '';
  const sufijo = campo.sufijo || '';
  if (!prefijo && !sufijo) return valor;
  const fijo = comparable(prefijo);
  if (fijo && comparable(valor).startsWith(fijo)) return valor;
  return `${prefijo}${valor}${sufijo}`;
};

// Los textos que se pintan, los MISMOS en la vista previa y en el PDF: el
// ejemplo ya no entra. Antes la vista previa lo enseñaba como si fuera el
// dato, y quien escribía el número o la iglesia en "Texto de ejemplo" lo veía
// en el certificado pero el PDF salía sin él. Un dato vacío se ve en el lienzo
// como su rótulo apagado, que el PDF no lleva.
export const textosParaPintarOnerrd = (diseno, valores, anchoPaginaPt, medir) =>
  (diseno?.campos || [])
    .filter((campo) => campo.visible)
    .map((campo) => {
      const texto = textoDeCampoOnerrd(campo, valores);
      return { campo, texto, tamano: tamanoQueCabeOnerrd(campo, texto, anchoPaginaPt, medir) };
    });

// Tamaño de letra final: el guardado, o menos si el texto no cabe en su caja.
// `medir(texto, campo)` devuelve el ancho del texto a 1 pt (lo hace el
// navegador con la fuente real); el PDF usa este mismo número.
export const tamanoQueCabeOnerrd = (campo, texto, anchoPaginaPt, medir) => {
  if (!campo.ajustarAlAncho || !texto || typeof medir !== 'function') return campo.tamano;
  const anchoCajaPt = (campo.ancho / 100) * anchoPaginaPt;
  const anchoA1pt = medir(texto, campo);
  const espaciado = campo.espaciado * Math.max(0, texto.length - 1);
  // El contorno sobresale de la letra por los dos lados y también ocupa caja.
  const contorno = campo.contorno ? 2 * (campo.grosorContorno || 0) : 0;
  if (!(anchoA1pt > 0)) return campo.tamano;
  const cabe = (anchoCajaPt - espaciado - contorno) / anchoA1pt;
  return redondear(Math.max(TAMANO_MINIMO, Math.min(campo.tamano, cabe)));
};

// CONTORNO DE LA LETRA. El PDF no sabe trazar el borde de un texto, así que se
// pinta debajo una copia del texto en el color del contorno por cada uno de
// estos desplazamientos (un círculo del radio del grueso): juntas forman el
// borde. La vista previa usa los MISMOS desplazamientos como `text-shadow`, y
// el borde sale igual en pantalla y en el PDF (un `-webkit-text-stroke` hacía
// esquinas en pico que el PDF dejaba redondas).
const PASOS_DE_CONTORNO = 24;

// DEGRADADO, igual en la vista previa (CSS) y en el PDF (lo dibuja el
// navegador en un lienzo). Las paradas en % del ancho del degradado.
export const paradasDeDegradadoOnerrd = (campo) => {
  const desde = campo.color;
  const hasta = campo.colorFin || DEGRADADO_INICIAL_ONERRD.fin;
  const inicio = numero(campo.inicioDegradado, 0);
  const fin = Math.max(inicio, numero(campo.finDegradado, 100));
  if (campo.reflejarDegradado === false) {
    return [
      { color: desde, posicion: inicio },
      { color: hasta, posicion: fin },
    ];
  }
  // Reflejado: la misma mezcla en cada mitad, de vuelta en la segunda.
  return [
    { color: desde, posicion: inicio / 2 },
    { color: hasta, posicion: fin / 2 },
    { color: hasta, posicion: 100 - fin / 2 },
    { color: desde, posicion: 100 - inicio / 2 },
  ];
};

export const cssDeDegradadoOnerrd = (campo) =>
  `linear-gradient(${numero(campo.anguloDegradado, 90)}deg, ${paradasDeDegradadoOnerrd(campo)
    .map(({ color, posicion }) => `${color} ${posicion}%`)
    .join(', ')})`;

// La línea del degradado en una caja de ancho × alto, como la calcula CSS: pasa
// por el centro con el ángulo dado (0 = hacia arriba, 90 = hacia la derecha) y
// es tan larga que las esquinas quedan en el 0 % y el 100 %.
export const lineaDeDegradadoOnerrd = (angulo, ancho, alto) => {
  const radianes = (numero(angulo, 90) * Math.PI) / 180;
  const dx = Math.sin(radianes);
  const dy = -Math.cos(radianes);
  const largo = Math.abs(ancho * dx) + Math.abs(alto * dy);
  const cx = ancho / 2;
  const cy = alto / 2;
  return {
    x1: cx - (dx * largo) / 2,
    y1: cy - (dy * largo) / 2,
    x2: cx + (dx * largo) / 2,
    y2: cy + (dy * largo) / 2,
  };
};

export const desplazamientosDeContorno = (grosor) => {
  const radio = numero(grosor, 0);
  if (!(radio > 0)) return [];
  return Array.from({ length: PASOS_DE_CONTORNO }, (_, indice) => {
    const angulo = (indice / PASOS_DE_CONTORNO) * 2 * Math.PI;
    return [
      Math.round(Math.cos(angulo) * radio * 1000) / 1000,
      Math.round(Math.sin(angulo) * radio * 1000) / 1000,
    ];
  });
};

// Caja del texto en puntos de la página (para el PDF).
//
// `lineaBase`: dónde cae la línea base del texto en la vista previa, contada
// desde arriba de la línea y en tamaños de letra (lo mide el navegador con la
// fuente real). El navegador reparte el interlineado arriba y abajo de la
// letra; el PDF pone la línea base a la altura de la letra (`ascensoPdf`)
// desde arriba, sin repartir nada. Con Oswald y Anton, letras altas, el PDF
// bajaba el texto ~0,14 de su tamaño (2 pt en un 13, 6 pt en el número): la
// caja sube esa diferencia y el texto queda donde se ve.
export const cajaDeTextoOnerrd = (campo, tamano, pagina, lineaBase) => {
  const ancho = (campo.ancho / 100) * pagina.ancho;
  const ascensoPdf = FUENTES_ONERRD.find((item) => item.value === campo.fuente)?.ascensoPdf;
  const ajuste = lineaBase > 0 && ascensoPdf ? (lineaBase - ascensoPdf) * tamano : 0;
  return {
    left: (campo.x / 100) * pagina.ancho - ancho / 2,
    top: (campo.y / 100) * pagina.alto - (tamano * INTERLINEADO_ONERRD) / 2 + ajuste,
    width: ancho,
  };
};

// Caja de una imagen o firma en puntos (centro + ancho; el alto sale de su
// proporción alto/ancho).
export const cajaDeImagenOnerrd = (elemento, proporcion, pagina) => {
  const ancho = (elemento.ancho / 100) * pagina.ancho;
  const alto = ancho * (numero(proporcion, 1) || 1);
  return {
    left: (elemento.x / 100) * pagina.ancho - ancho / 2,
    top: (elemento.y / 100) * pagina.alto - alto / 2,
    width: ancho,
    height: alto,
  };
};

// Página a partir del SVG: manda el viewBox; si no hay, width/height.
export const paginaDesdeSvg = (textoSvg = '') => {
  const etiqueta = String(textoSvg).match(/<svg\b[^>]*>/i)?.[0] || '';
  const viewBox = etiqueta.match(/viewBox\s*=\s*["']([^"']+)["']/i)?.[1];
  if (viewBox) {
    const [, , w, h] = viewBox
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    if (w > 0 && h > 0) return { ancho: redondear(w), alto: redondear(h) };
  }
  const w = parseFloat(etiqueta.match(/\swidth\s*=\s*["']([\d.]+)/i)?.[1]);
  const h = parseFloat(etiqueta.match(/\sheight\s*=\s*["']([\d.]+)/i)?.[1]);
  if (w > 0 && h > 0) return { ancho: redondear(w), alto: redondear(h) };
  return { ...PAGINA_ONERRD_POR_DEFECTO };
};

export const nombreDeArchivoOnerrd = (numeroRegistro, valores = {}) => {
  const destacamento = String(valores.nombreDestacamento || valores.numeroDestacamento || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
  return `ONERRD-${numeroRegistro || 'prueba'}${destacamento ? `-${destacamento}` : ''}.pdf`;
};
