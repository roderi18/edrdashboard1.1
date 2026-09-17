// ----------------------------------------------------------------------
// EL DISEÑO DE CADA BLOQUE: COLORES, TAMAÑOS, TEXTOS FIJOS, ICONOS Y QUE SE VE.
//
// El contenido de un bloque es QUE dice (el titulo de la actividad, los
// comunicados). El diseño es COMO se ve: el color del fondo, el tamaño del
// titulo, el "Faltan" encima de la cuenta, si se enseña el boton. Hasta aqui eso
// estaba escrito en el componente y solo se cambiaba tocando codigo; ahora se
// cambia desde el Designer, igual que el encabezado de la tienda.
//
// VA APARTE DEL CONTENIDO, en `diseno`, y no mezclado con el: varios bloques son
// una lista (comunicados, eventos…) y a una lista no se le pueden colgar campos.
//
// UN DISEÑO VACIO SE PINTA EXACTAMENTE COMO HOY. Cada ajuste es opcional; el
// componente usa el suyo solo si esta, y si no, lo que llevaba escrito. Por eso
// aqui no hay "valores por defecto" que se apliquen: `porDefecto` es solo lo que
// el editor enseña para saber de donde se parte.
//
// LOS COLORES SON HEXADECIMALES, como en el encabezado de la tienda: el diseño se
// guarda una vez y lo ve gente en modo claro y en oscuro, asi que el color
// elegido tiene que significar lo mismo en los dos. Solo `#rrggbb` o
// `#rrggbbaa`: aceptar cualquier cadena seria aceptar `url(...)` en el CSS.
// ----------------------------------------------------------------------

import { texto, icono, unoDe, numero, destino, esObjeto } from './saneado.mjs';

export const TIPOS_DE_AJUSTE = Object.freeze({
  texto: 'texto',
  color: 'color',
  tamano: 'tamano',
  numero: 'numero',
  icono: 'icono',
  destino: 'destino',
  interruptor: 'interruptor',
  opcion: 'opcion',
});

export const GRUPOS_DE_AJUSTE = Object.freeze({
  textos: 'Textos y enlaces',
  colores: 'Colores',
  forma: 'Tamaños y forma',
  mostrar: 'Qué se muestra',
});

const COLOR_HEX = /^#(?:[0-9a-f]{6}|[0-9a-f]{8})$/i;

/** Un color hexadecimal, en mayusculas, o `null`. */
export const colorHex = (valor) =>
  typeof valor === 'string' && COLOR_HEX.test(valor.trim()) ? valor.trim().toUpperCase() : null;

export const ALINEACIONES = Object.freeze([
  { valor: 'left', etiqueta: 'Izquierda' },
  { valor: 'center', etiqueta: 'Centro' },
  { valor: 'right', etiqueta: 'Derecha' },
]);

export const PESOS_DE_LETRA = Object.freeze([
  { valor: '400', etiqueta: 'Normal' },
  { valor: '600', etiqueta: 'Semi negrita' },
  { valor: '700', etiqueta: 'Negrita' },
  { valor: '800', etiqueta: 'Extra negrita' },
]);

// ----------------------------------------------------------------------
// LAS PIEZAS PARA DECLARAR AJUSTES
// ----------------------------------------------------------------------

const deTexto = (campo, etiqueta, porDefecto, { max = 60, ayuda } = {}) => ({
  campo,
  tipo: TIPOS_DE_AJUSTE.texto,
  grupo: GRUPOS_DE_AJUSTE.textos,
  etiqueta,
  porDefecto,
  max,
  ayuda,
});

const deDestino = (campo, etiqueta, porDefecto) => ({
  campo,
  tipo: TIPOS_DE_AJUSTE.destino,
  grupo: GRUPOS_DE_AJUSTE.textos,
  etiqueta,
  porDefecto,
});

const deIcono = (campo, etiqueta, porDefecto) => ({
  campo,
  tipo: TIPOS_DE_AJUSTE.icono,
  grupo: GRUPOS_DE_AJUSTE.textos,
  etiqueta,
  porDefecto,
});

const deColor = (campo, etiqueta, ayuda) => ({
  campo,
  tipo: TIPOS_DE_AJUSTE.color,
  grupo: GRUPOS_DE_AJUSTE.colores,
  etiqueta,
  ayuda,
});

const deTamano = (campo, etiqueta, { min, max, porDefecto }) => ({
  campo,
  tipo: TIPOS_DE_AJUSTE.tamano,
  grupo: GRUPOS_DE_AJUSTE.forma,
  etiqueta,
  min,
  max,
  porDefecto,
});

const deInterruptor = (campo, etiqueta) => ({
  campo,
  tipo: TIPOS_DE_AJUSTE.interruptor,
  grupo: GRUPOS_DE_AJUSTE.mostrar,
  etiqueta,
  porDefecto: true,
});

const deOpcion = (campo, etiqueta, opciones, porDefecto) => ({
  campo,
  tipo: TIPOS_DE_AJUSTE.opcion,
  grupo: GRUPOS_DE_AJUSTE.forma,
  etiqueta,
  opciones,
  porDefecto,
});

// Lo que tiene cualquier tarjeta. Los del titulo y el texto son px: el diseño
// de hoy usa las variantes del tema, que cambian con el ancho; un tamaño elegido
// en el Designer es el mismo en todos.
const tarjeta = ({ tamanoTitulo = 16, tamanoTexto = 14, radio = 16 } = {}) => [
  deColor('colorFondo', 'Fondo'),
  deColor('colorFondo2', 'Fondo, segundo tono', 'Con los dos tonos, el fondo es un degradado.'),
  deColor('colorTitulo', 'Títulos'),
  deColor('colorTexto', 'Textos'),
  deColor('colorAcento', 'Iconos y acentos'),
  deTamano('tamanoTitulo', 'Tamaño del título (px)', {
    min: 12,
    max: 48,
    porDefecto: tamanoTitulo,
  }),
  deTamano('tamanoTexto', 'Tamaño del texto (px)', { min: 10, max: 24, porDefecto: tamanoTexto }),
  deOpcion('pesoTitulo', 'Grosor del título', PESOS_DE_LETRA, '600'),
  deTamano('radio', 'Redondeo de las esquinas (px)', { min: 0, max: 40, porDefecto: radio }),
];

// ----------------------------------------------------------------------
// LOS AJUSTES DE CADA BLOQUE
// ----------------------------------------------------------------------

export const AJUSTES_DE_DISENO = Object.freeze({
  bienvenida: [
    deTexto('saludo', 'Saludo', '¡Bienvenido, {nombre}!', {
      ayuda: '{nombre} se cambia por el primer nombre de quien entra.',
    }),
    deTexto('textoNivel', 'Antes del número de nivel', 'Nivel', { max: 20 }),
    ...tarjeta({ tamanoTitulo: 24 }),
    deColor('colorLema', 'Frase'),
    deColor('colorBarra', 'Barra del nivel'),
    deInterruptor('mostrarFoto', 'Foto de quien entra'),
    deInterruptor('mostrarUbicacion', 'Destacamento y región'),
    deInterruptor('mostrarLema', 'Frase'),
    deInterruptor('mostrarCifras', 'Cifras'),
    deInterruptor('mostrarNivel', 'Nivel'),
  ],
  'accesos-rapidos': [
    deColor(
      'colorFondo',
      'Fondo de cada acceso',
      'Sin elegir, cada uno lleva el velo de su acento.'
    ),
    deColor('colorAcento', 'Caja del icono'),
    deColor('colorIcono', 'Icono'),
    deColor('colorTitulo', 'Texto'),
    deTamano('tamanoTitulo', 'Tamaño del texto (px)', { min: 10, max: 28, porDefecto: 14 }),
    deOpcion('pesoTitulo', 'Grosor del texto', PESOS_DE_LETRA, '600'),
    deTamano('radio', 'Redondeo de las esquinas (px)', { min: 0, max: 40, porDefecto: 16 }),
    deOpcion(
      'columnas',
      'Columnas en escritorio',
      [
        { valor: '2', etiqueta: '2' },
        { valor: '3', etiqueta: '3' },
        { valor: '4', etiqueta: '4' },
      ],
      '4'
    ),
    deInterruptor('mostrarFlecha', 'Flecha a la derecha'),
  ],
  'proxima-actividad': [
    deTexto('etiqueta', 'Etiqueta de arriba', 'Próxima actividad', { max: 40 }),
    deIcono('iconoEtiqueta', 'Icono de la etiqueta', 'custom:calendar-agenda-outline'),
    deTexto('textoFaltan', 'Encima de la cuenta', 'Faltan', { max: 20 }),
    deTexto('textoDias', 'Después del número', 'días', { max: 20 }),
    ...tarjeta({ tamanoTitulo: 18 }),
    deColor('colorBoton', 'Botón'),
    deColor('colorTextoBoton', 'Texto del botón'),
    deColor('colorEstado', 'Sello del estado'),
    deInterruptor('mostrarLugar', 'Lugar'),
    deInterruptor('mostrarFechas', 'Fechas'),
    deInterruptor('mostrarCuenta', 'Cuenta atrás'),
    deInterruptor('mostrarEstado', 'Sello del estado'),
    deInterruptor('mostrarBoton', 'Botón'),
  ],
  'mi-progreso': [
    deTexto('titulo', 'Título', 'Mi progreso', { max: 40 }),
    deIcono('iconoTitulo', 'Icono del título', 'solar:medal-ribbon-bold'),
    deTexto('textoActividades', 'Después del total', 'actividades', { max: 30 }),
    deTexto('textoBoton', 'Texto del botón', 'Ver mi progreso', { max: 30 }),
    deDestino('destinoBoton', 'El botón lleva a', '/dashboard/certificates'),
    ...tarjeta(),
    deColor('colorBarra', 'Barra de progreso'),
    deInterruptor('mostrarAreas', 'Áreas'),
    deInterruptor('mostrarBoton', 'Botón'),
  ],
  historias: [
    deTexto('titulo', 'Título', 'Historias', { max: 40 }),
    deIcono('iconoTitulo', 'Icono del título', 'solar:gallery-wide-bold'),
    deTexto('textoTuHistoria', 'Primer círculo', 'Tu historia', { max: 20 }),
    ...tarjeta(),
    deTamano('tamanoCirculo', 'Tamaño de los círculos (px)', { min: 40, max: 96, porDefecto: 56 }),
    deInterruptor('mostrarTuHistoria', 'Círculo "Tu historia"'),
  ],
  'proximos-eventos': [
    deTexto('titulo', 'Título', 'Próximos eventos', { max: 40 }),
    deIcono('iconoTitulo', 'Icono del título', 'solar:cup-star-bold'),
    deTexto('textoEnlace', 'Texto del enlace', 'Ver calendario', { max: 30 }),
    deDestino('destinoEnlace', 'El enlace lleva a', '/dashboard/calendar'),
    ...tarjeta(),
    deColor('colorFecha', 'Hoja de la fecha'),
    deInterruptor('mostrarEnlace', 'Enlace'),
    deInterruptor('mostrarLugar', 'Lugar'),
    deInterruptor('mostrarEstado', 'Estado'),
  ],
  'destacamento-destacado': [
    deTexto('titulo', 'Título', 'Destacamento destacado de la semana', { max: 60 }),
    deIcono('iconoTitulo', 'Icono del título', 'solar:medal-ribbon-star-bold'),
    deTexto('textoMiembros', 'Después del número', 'miembros', { max: 20 }),
    deTexto('textoBoton', 'Texto del botón', 'Ver historia', { max: 30 }),
    deDestino('destinoBoton', 'El botón lleva a', '/dashboard/level/dest'),
    ...tarjeta(),
    deColor('colorCaja', 'Recuadro'),
    deColor('colorCaja2', 'Recuadro, segundo tono'),
    deColor('colorBoton', 'Botón'),
    deInterruptor('mostrarValoracion', 'Valoración'),
    deInterruptor('mostrarBoton', 'Botón'),
  ],
  comunicados: [
    deTexto('titulo', 'Título', 'Comunicados oficiales', { max: 40 }),
    deIcono('iconoTitulo', 'Icono del título', 'solar:bell-bing-bold'),
    deIcono('iconoElemento', 'Icono de cada comunicado', 'solar:file-text-bold'),
    deTexto('textoEnlace', 'Texto del enlace', 'Ver todos', { max: 30 }),
    deDestino('destinoEnlace', 'El enlace lleva a', '/dashboard/file-manager'),
    ...tarjeta(),
    deInterruptor('mostrarEnlace', 'Enlace'),
    deInterruptor('mostrarOrigen', 'Quién lo envía'),
    deInterruptor('mostrarFecha', 'Fecha'),
  ],
  lema: [
    deIcono('icono', 'Icono', 'solar:shield-check-bold'),
    ...tarjeta({ tamanoTitulo: 18, tamanoTexto: 12 }),
    deOpcion('alineacion', 'Alineación', ALINEACIONES, 'left'),
    deInterruptor('mostrarIcono', 'Icono'),
  ],
});

export const ajustesDe = (idBloque) => AJUSTES_DE_DISENO[idBloque] ?? [];

// ----------------------------------------------------------------------
// EL SANEADO
// ----------------------------------------------------------------------

const sanearAjuste = (ajuste, valor) => {
  switch (ajuste.tipo) {
    case TIPOS_DE_AJUSTE.texto:
      // Vacio vale: es quitar ese texto.
      return texto(valor, { max: ajuste.max });
    case TIPOS_DE_AJUSTE.color:
      return colorHex(valor);
    case TIPOS_DE_AJUSTE.tamano:
    case TIPOS_DE_AJUSTE.numero:
      return numero(valor, { min: ajuste.min, max: ajuste.max });
    case TIPOS_DE_AJUSTE.icono:
      return icono(valor);
    case TIPOS_DE_AJUSTE.destino:
      return destino(valor);
    case TIPOS_DE_AJUSTE.interruptor:
      return typeof valor === 'boolean' ? valor : null;
    case TIPOS_DE_AJUSTE.opcion:
      return unoDe(
        valor,
        ajuste.opciones.map((opcion) => opcion.valor)
      );
    default:
      return null;
  }
};

/**
 * El diseño limpio de un bloque, o `null` si algo no vale.
 *
 * - Sin diseño (`undefined`), un objeto vacio: se pinta como hoy.
 * - Un ajuste que el bloque no tiene se ignora: no pinta nada, y asi un diseño
 *   guardado con un ajuste que despues se quito no tumba el bloque.
 * - Un ajuste conocido con un valor que no vale invalida el diseño entero, como
 *   cualquier otro campo roto: publicar algo distinto de lo que se vio al editar
 *   seria peor.
 */
export function sanearDiseno(idBloque, valor) {
  if (valor === undefined || valor === null) return {};
  if (!esObjeto(valor)) return null;

  const ajustes = ajustesDe(idBloque);
  const presentes = ajustes
    .filter((ajuste) => valor[ajuste.campo] !== undefined)
    .map((ajuste) => [ajuste.campo, sanearAjuste(ajuste, valor[ajuste.campo])]);

  return presentes.some(([, limpio]) => limpio === null) ? null : Object.fromEntries(presentes);
}

export const disenoVacio = (diseno) => !esObjeto(diseno) || Object.keys(diseno).length === 0;
