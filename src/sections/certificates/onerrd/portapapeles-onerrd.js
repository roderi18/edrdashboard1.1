import { acotarPosicion, crearIdDeCampo } from 'src/utils/certificado-onerrd.mjs';

// ----------------------------------------------------------------------
// COPIAR Y PEGAR EN LOS LIENZOS ONERRD (Ctrl + C, Ctrl + V, Ctrl + D).
//
// Un portapapeles propio, en memoria, compartido por el lienzo del
// certificado y el de la factura: un texto copiado en uno se pega en el otro.
// No va al del sistema: lo copiado son elementos del diseño, no texto.
// Guarda una LISTA: con varios elegidos (Ctrl + clic) se copian todos.
//
// Cada pegado cae un poco más abajo y a la derecha que el anterior, para que
// la copia no tape al original y se vea que se pegó.
// ----------------------------------------------------------------------

const DESPLAZAMIENTO = 2; // % de la página

// [{ tipo: 'campo' | 'formas', elemento, texto }]
let portapapeles = null;

export const copiarOnerrd = (elementos) => {
  portapapeles = elementos.length ? structuredClone(elementos) : null;
};

export const leerPortapapelesOnerrd = () => portapapeles;

// "Barra (copia)" y no "Barra (copia) (copia)" al pegar la copia de una copia.
const nombreDeCopia = (nombre, maximo) =>
  `${String(nombre || '').replace(/( \(copia\))+$/, '')} (copia)`.slice(0, maximo);

const desplazado = (elemento) => ({
  x: acotarPosicion(elemento.x + DESPLAZAMIENTO),
  y: acotarPosicion(elemento.y + DESPLAZAMIENTO),
});

// La copia de un texto es siempre un texto FIJO con lo que se leía: un dato
// del registro ("Facturar a", el número…) copiado con otro id leería un dato
// que no existe y saldría vacío.
export const copiaDeCampoOnerrd = (campo, texto, existentes) => {
  const fijo = campo.tipo === 'fijo';
  return {
    ...campo,
    ...desplazado(campo),
    id: crearIdDeCampo(existentes),
    tipo: 'fijo',
    etiqueta: nombreDeCopia(campo.etiqueta, 80),
    contenido: fijo ? campo.contenido : texto || campo.etiqueta,
    prefijo: fijo ? campo.prefijo : '',
    sufijo: fijo ? campo.sufijo : '',
    deFabrica: false,
    visible: true,
  };
};

export const copiaDeFormaOnerrd = (forma, id) => ({
  ...forma,
  ...desplazado(forma),
  id,
  etiqueta: nombreDeCopia(forma.etiqueta, 60),
  visible: true,
});

// Tras pegar, lo copiado pasa a ser lo pegado: el siguiente pegado cae al
// lado de esto, no encima.
export const recordarPegadoOnerrd = (elementos) => {
  if (portapapeles && elementos.length) portapapeles = structuredClone(elementos);
};
