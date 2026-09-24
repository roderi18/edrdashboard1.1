import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const leer = (relativa) => fs.readFileSync(relativa, 'utf8');

const PANTALLA = leer('src/sections/attendance/view/attendance-quick-view.jsx');
const PDF = leer('src/utils/download-table-pdf-documento.jsx');
const BOTON = leer('src/components/export-table-button/export-table-button.jsx');

// ----------------------------------------------------------------------
// EL RESUMEN DEL DIA, PARA LEERLO EN PAPEL.
//
// El documento descargado salia con las columnas en el orden interno —Codigo,
// Miembro, Division, Estado— y la lista en el mismo orden de la pantalla, que es
// alfabetico. Para saber quien falto habia que cruzar la fila entera hasta la
// ultima columna, persona por persona, en una hoja de treinta renglones.
//
// Ahora el estado va pegado al nombre, los presentes salen primero y cada marca
// lleva su color de fondo: el mismo de la pantalla, en su tono claro, porque es
// un fondo detras de texto que hay que leer y no un semaforo.
// ----------------------------------------------------------------------

test('el estado va justo al lado del miembro', () => {
  const columnas = [
    ...PANTALLA.matchAll(/id: '(codigo|nombre|estado|division|ultimaPresencia)'/g),
  ].map((m) => m[1]);

  // Las dos descargas: la del resumen del dia y la del boton de la barra, que
  // ademas lleva "Ultima presencia" al final.
  assert.deepEqual(columnas.slice(0, 4), ['codigo', 'nombre', 'estado', 'division']);
  assert.deepEqual(columnas.slice(4, 9), [
    'codigo',
    'nombre',
    'estado',
    'division',
    'ultimaPresencia',
  ]);
});

test('primero los que asistieron', () => {
  assert.match(
    PANTALLA,
    /const ORDEN_DE_ESTADOS = \['present', 'absent', 'excused', 'sick', 'other', 'pending'\];/
  );
  // A igualdad de marca manda el nombre, no el orden en que llego la lista.
  assert.match(PANTALLA, /a\.nombre\.localeCompare\(b\.nombre, 'es'\)/);
  // LAS DOS descargas ordenan igual: la del boton de la barra es la que se baja
  // de verdad, y era la unica que se habia quedado sin tocar.
  assert.equal([...PANTALLA.matchAll(/ordenarParaDescarga\(/g)].length, 2);
});

test('un ausente sin marcar ordena y se pinta como ausente', () => {
  // Se guarda como ausente y en pantalla se lee "Ausente": si aqui cayera en
  // 'pending' saldria al final de la hoja y sin color.
  assert.match(PANTALLA, /if \(status === AUTO_ABSENT_STATUS\) return 'absent';/);
});

test('se dice "Presente", no "Asistio"', () => {
  assert.match(PANTALLA, /label: 'Presente'/);
  assert.doesNotMatch(PANTALLA, /'Asistió'/);
});

test('cada marca lleva su color, y el de excusa es azul', () => {
  // Los tonos salen del tema, no escritos a mano: el PDF no tiene tema, pero el
  // codigo de colores tiene que seguir siendo el mismo que el de la pantalla.
  assert.match(PANTALLA, /present: themeConfig\.palette\.success\.lighter,/);
  assert.match(PANTALLA, /absent: themeConfig\.palette\.warning\.lighter,/);
  assert.match(PANTALLA, /excused: themeConfig\.palette\.primary\.lighter,/);
  assert.match(PANTALLA, /sick: themeConfig\.palette\.error\.lighter,/);
  assert.match(PANTALLA, /FONDO_DE_ESTADO\[fila\?\.clave\] \|\| null/);
  // El color va a las dos descargas, no solo a la del resumen.
  assert.equal([...PANTALLA.matchAll(/fondoDeFila(?:=\{|: )fondoDeFilaPorEstado/g)].length, 2);
});

test('el PDF pinta la fila entera, no solo la celda del estado', () => {
  // Un rectangulo de color suelto marca la celda pero no separa a una persona de
  // la siguiente cuando se recorre la lista.
  assert.match(PDF, /const getRowBackground = \(fondoDeFila, row\) =>/);
  assert.match(
    PDF,
    /style=\{\[styles\.row, \.\.\.\(fondo \? \[\{ backgroundColor: fondo \}\] : \[\]\)\]\}/
  );
});

test('el Excel tambien sale con los colores', () => {
  // `xlsx` guarda los datos y tira el estilo —pintar celdas es de su version de
  // pago—, asi que la hoja salia en blanco y negro mientras el PDF si tenia
  // color: el mismo dato se leia de dos maneras segun donde se abriera.
  assert.match(BOTON, /const downloadExcelConColores = async/);
  assert.match(BOTON, /await import\('exceljs'\)/);
  assert.match(
    BOTON,
    /celda\.fill = \{ type: 'pattern', pattern: 'solid', fgColor: \{ argb \} \};/
  );
  assert.match(BOTON, /\} else if \(fondoDeFila\) \{/);
});
