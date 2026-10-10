import path from 'path';
import { GlobalFonts, createCanvas } from '@napi-rs/canvas';

import {
  PESOS_ONERRD,
  pesoDeCampoOnerrd,
  INTERLINEADO_ONERRD,
} from 'src/utils/certificado-onerrd.mjs';

// ----------------------------------------------------------------------
// LAS MEDIDAS DE LOS TEXTOS DEL CERTIFICADO Y LA FACTURA, en el servidor.
//
// En el navegador, el tamaño con que cabe un texto, su línea base y los textos
// con degradado los mide y dibuja el propio navegador (`imagenes-onerrd.js`).
// Para emitir sin navegador (un pago con PayPal) se hace lo mismo con
// `@napi-rs/canvas` y las MISMAS fuentes de `public/fuentes`: el PDF sale con
// las medidas de siempre. Las tres estándar (Helvetica, Times, Courier) no
// vienen en un servidor mínimo: si faltan, miden con Roboto, que se les parece.
// ----------------------------------------------------------------------

const CARPETA_FUENTES = path.join(process.cwd(), 'public', 'fuentes');

let registradas = false;

export const registrarFuentesDeMedidaOnerrd = () => {
  if (registradas) return;
  const archivo = (nombre) => path.join(CARPETA_FUENTES, nombre);
  GlobalFonts.registerFromPath(archivo('Roboto-Regular.ttf'), 'OnerrdRoboto');
  GlobalFonts.registerFromPath(archivo('Roboto-Bold.ttf'), 'OnerrdRoboto');
  Object.values(PESOS_ONERRD).forEach(({ archivo: grueso }) =>
    GlobalFonts.registerFromPath(archivo(`Oswald-${grueso}.ttf`), 'OnerrdOswald')
  );
  GlobalFonts.registerFromPath(archivo('Anton-Regular.ttf'), 'OnerrdAnton');
  ['Helvetica', 'Arial', 'Times New Roman', 'Times', 'Courier New', 'Courier'].forEach((nombre) => {
    if (!GlobalFonts.has(nombre)) {
      GlobalFonts.registerFromPath(archivo('Roboto-Regular.ttf'), nombre);
      GlobalFonts.registerFromPath(archivo('Roboto-Bold.ttf'), nombre);
    }
  });
  registradas = true;
};

// Las mismas familias que usa la vista previa (`FUENTES_ONERRD[].css`).
const FAMILIAS = {
  Helvetica: 'Helvetica, Arial, sans-serif',
  Times: '"Times New Roman", Times, serif',
  Courier: '"Courier New", Courier, monospace',
  Roboto: 'OnerrdRoboto',
  Oswald: 'OnerrdOswald',
  Anton: 'OnerrdAnton',
};

export const familiaDeFuenteOnerrd = (fuente) => FAMILIAS[fuente] || FAMILIAS.Helvetica;

export const crearLienzoOnerrd = (ancho, alto) => createCanvas(ancho, alto);

let contexto = null;
const contextoDeMedida = () => {
  registrarFuentesDeMedidaOnerrd();
  if (!contexto) contexto = createCanvas(16, 16).getContext('2d');
  return contexto;
};

const fuenteCss = (campo, tamano) =>
  `${campo.cursiva ? 'italic ' : ''}${pesoDeCampoOnerrd(campo)} ${tamano}px ${familiaDeFuenteOnerrd(campo.fuente)}`;

// Ancho del texto a 1 pt (se mide a 100 px para no perder precisión).
export const medirTextoServidorOnerrd = (texto, campo) => {
  const ctx = contextoDeMedida();
  ctx.font = fuenteCss(campo, 100);
  return ctx.measureText(texto).width / 100;
};

const lineasBase = new Map();

// Dónde cae la línea base de una línea de texto desde su borde de arriba, en
// tamaños de letra, con el mismo interlineado que el lienzo: el navegador
// reparte el interlineado alrededor del ascenso y el descenso de la fuente.
export const lineaBaseServidorOnerrd = (campo) => {
  const ctx = contextoDeMedida();
  const clave = fuenteCss({ ...campo, cursiva: false }, 1000);
  if (lineasBase.has(clave)) return lineasBase.get(clave);
  ctx.font = clave;
  const { fontBoundingBoxAscent: ascenso, fontBoundingBoxDescent: descenso } =
    ctx.measureText('Hg');
  const valor =
    ascenso > 0 ? (INTERLINEADO_ONERRD * 1000 - (ascenso + descenso)) / 2000 + ascenso / 1000 : 0;
  lineasBase.set(clave, valor);
  return valor;
};
