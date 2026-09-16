// ----------------------------------------------------------------------
// LAS PIEZAS CON LAS QUE SE LIMPIA LO QUE PUBLICA EL DESIGNER.
//
// Lo que se publica lo lee toda la organizacion en su portada, y llega de un
// formulario —o de quien escriba en Firestore con permiso—. Antes de pintarse
// pasa por aqui, y lo que no cuadra no se pinta: se cae al valor de fabrica.
//
// Las reglas del proyecto viven en estas piezas, para que ningun bloque tenga que
// acordarse de ellas:
//
//   - COLORES, solo con nombre: los tonos de marca de la portada o los colores de
//     estado del tema. Nunca un hex suelto copiado de una captura (`CLAUDE.md`).
//   - ICONOS, solo del paquete registrado (`icon-sets.js`). Uno sin registrar se
//     descarga por internet y parpadea al cargar.
//   - DESTINOS de botones y enlaces: una ruta de la aplicacion o una direccion
//     `https`. Nada de `javascript:`, de `//otro-sitio` ni de `http` suelto.
//
// Cada pieza devuelve el valor limpio o `null` si no sirve. Quien arma el bloque
// decide si un `null` invalida todo el bloque o solo se descarta esa pieza.
// ----------------------------------------------------------------------

import ICONOS_REGISTRADOS from '../../components/iconify/icon-sets.js';

/** Los acentos de marca de la portada (`useTonosDeMarca().ACENTOS`). */
export const ACENTOS_DE_MARCA = Object.freeze(['azul', 'verde', 'ambar', 'morado']);

/** Los colores que admite `Label`: los de estado del tema. */
export const COLORES_DE_ESTADO = Object.freeze([
  'default',
  'primary',
  'secondary',
  'info',
  'success',
  'warning',
  'error',
]);

const esObjeto = (valor) => Boolean(valor) && typeof valor === 'object' && !Array.isArray(valor);

export { esObjeto };

/** Un texto recortado, con largo maximo. Vacio solo si no es obligatorio. */
export function texto(valor, { max = 200, obligatorio = false } = {}) {
  if (typeof valor !== 'string') return obligatorio ? null : '';

  const limpio = valor.trim();

  if (!limpio) return obligatorio ? null : '';
  if (limpio.length > max) return null;

  return limpio;
}

/** Un numero dentro de sus limites. `entero` rechaza los decimales. */
export function numero(valor, { min = -Infinity, max = Infinity, entero = false } = {}) {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) return null;
  if (entero && !Number.isInteger(valor)) return null;
  if (valor < min || valor > max) return null;

  return valor;
}

/** Una de las opciones de la lista, tal cual. */
export const unoDe = (valor, opciones) => (opciones.includes(valor) ? valor : null);

/**
 * La clave de un elemento dentro de una lista (un evento, un comunicado): letras
 * minusculas, numeros y guiones. Es lo que usa React para no confundir filas al
 * reordenarlas, asi que no puede llevar espacios ni simbolos.
 */
export const clave = (valor) =>
  typeof valor === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(valor) && valor.length <= 60
    ? valor
    : null;

export const icono = (valor) =>
  typeof valor === 'string' && Object.prototype.hasOwnProperty.call(ICONOS_REGISTRADOS, valor)
    ? valor
    : null;

export const acentoDeMarca = (valor) => unoDe(valor, ACENTOS_DE_MARCA);

export const colorDeEstado = (valor) => unoDe(valor, COLORES_DE_ESTADO);

/**
 * A donde lleva un boton o un enlace.
 *
 * Una ruta de la aplicacion empieza por una sola barra ("/dashboard/..."); con
 * dos ("//sitio.com") el navegador la toma por otro dominio. Hacia fuera, solo
 * `https`, y se comprueba con el analizador de direcciones y no a ojo.
 */
export function destino(valor) {
  if (typeof valor !== 'string') return null;

  const limpio = valor.trim();

  if (!limpio || limpio.length > 500 || /\s/.test(limpio)) return null;

  if (limpio.startsWith('/')) {
    return limpio.startsWith('//') || limpio.includes('\\') ? null : limpio;
  }

  try {
    const direccion = new URL(limpio);

    return direccion.protocol === 'https:' && direccion.hostname ? direccion.href : null;
  } catch {
    return null;
  }
}

/**
 * Una lista limpia: cada elemento pasa por `elemento` y no se admiten mas de
 * `max`. Basta UN elemento que no sirva, o pasarse del maximo, para devolver
 * `null`: descartar filas en silencio publicaria algo distinto de lo que se vio
 * al editar, y nadie sabria por que falta el tercer evento.
 */
export function lista(valor, elemento, { max = 20 } = {}) {
  if (!Array.isArray(valor) || valor.length > max) return null;

  const limpios = valor.map(elemento);

  return limpios.some((item) => item === null) ? null : limpios;
}

/**
 * Un objeto armado pieza a pieza vale solo si todas sus piezas valen. Asi cada
 * bloque escribe sus campos una vez y no repite la comprobacion.
 */
export const siTodoVale = (objeto) =>
  Object.values(objeto).some((valor) => valor === null) ? null : objeto;

/**
 * Las claves de una lista no se repiten. Dos eventos con la misma clave se
 * pisan al pintarse: React enseña uno y se come el otro.
 */
export const clavesSinRepetir = (elementos) =>
  new Set(elementos.map((elemento) => elemento.clave)).size === elementos.length;
