// ----------------------------------------------------------------------
// CSV separado por barras verticales (|).
//
// La barra se eligio en vez de la coma porque los datos llevan comas: las
// direcciones ("Santo Domingo, Santo Domingo Este, ...") y algunos nombres. Con
// comas, cada archivo habria que entrecomillarlo entero o se partiria mal; con
// barras, el archivo se lee de un vistazo y se edita a mano sin miedo.
// ----------------------------------------------------------------------

const SEPARADOR = '|';

// Excel abre el archivo con la codificacion del sistema si no ve esta marca, y
// entonces los acentos salen rotos. Tres bytes que evitan ese soporte tecnico.
const MARCA_UTF8 = '\uFEFF';

const limpiarCelda = (valor) => String(valor ?? '').replace(/[\r\n|]+/g, ' ').trim();

export const construirCsvPipe = (cabeceras = [], filas = []) =>
  [cabeceras, ...filas].map((fila) => fila.map(limpiarCelda).join(SEPARADOR)).join('\r\n');

export const descargarCsvPipe = ({ nombreArchivo, cabeceras, filas }) => {
  const contenido = construirCsvPipe(cabeceras, filas);
  const blob = new Blob([`${MARCA_UTF8}${contenido}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');

  enlace.href = url;
  enlace.download = nombreArchivo;
  enlace.click();
  URL.revokeObjectURL(url);
};

// Devuelve un objeto por fila, con la cabecera como clave, igual que hace
// `readExcelRows`: asi el resto del codigo trata los dos formatos por igual.
export const parsearCsvPipe = (texto = '') => {
  const lineas = String(texto)
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((linea) => linea.trim() !== '');

  if (!lineas.length) return [];

  // Se aceptan tambien tabulaciones: es lo que sale al copiar de una hoja de
  // calculo, y rechazar ese pegado obligaria a un paso intermedio inutil.
  const separador = lineas[0].includes(SEPARADOR) ? SEPARADOR : '\t';
  const cabeceras = lineas[0].split(separador).map((celda) => celda.trim());

  return lineas.slice(1).map((linea) => {
    const celdas = linea.split(separador);

    return Object.fromEntries(
      cabeceras.map((cabecera, indice) => [cabecera, (celdas[indice] ?? '').trim()])
    );
  });
};

export const esArchivoCsv = (file) => /\.(csv|txt|tsv)$/i.test(file?.name || '');
