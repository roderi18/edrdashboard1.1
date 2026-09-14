import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const leer = (relativa) => fs.readFileSync(relativa, 'utf8');

const CAJON = leer('src/layouts/components/notifications-drawer/index.jsx');
const LAYOUT = leer('src/layouts/dashboard/layout.jsx');

// ----------------------------------------------------------------------
// LA CAMPANA ABRE AL INSTANTE Y "LEIDO" SE VE AL INSTANTE.
//
// Al pulsar la campana el cajon tardaba: se pintaban TODAS las filas antes de
// dejarlo abrir. Y al pulsar un aviso se esperaba a Firestore para cerrar y
// navegar, asi que la fila seguia igual durante el viaje; ademas la recarga de
// cada 30 s podia devolverlo a "no leido" si llegaba antes que la escritura.
// ----------------------------------------------------------------------

test('el cajon abre con filas de espera y la lista llega despues', () => {
  assert.match(CAJON, /\{!listaLista && <FilasDeEspera \/>\}/);
  assert.match(CAJON, /requestAnimationFrame\(\(\) => setListaLista\(true\)\)/);
});

test('la lista se pinta por tandas y pide mas al llegar al final', () => {
  assert.match(CAJON, /const TANDA = 15;/);
  assert.match(CAJON, /notificationsFiltradas\.slice\(0, filasVisibles\)/);
  assert.match(CAJON, /new IntersectionObserver\(/);
});

test('marcar como leido no espera a la base', () => {
  const manejador = CAJON.slice(
    CAJON.indexOf('const handleClickNotification'),
    CAJON.indexOf('const handleMarkAsAttended')
  );

  assert.doesNotMatch(manejador, /await /);
  assert.match(manejador, /isUnRead: false, estado: 'leida'/);
});

test('la recarga de cada 30 segundos no deshace lo recien marcado', () => {
  assert.match(LAYOUT, /const marcasPendientesRef = useRef\(new Map\(\)\);/);
  assert.match(LAYOUT, /apuntarMarca\(notificationIds, \{ isUnRead: false, estado: 'leida' \}\);/);
  assert.match(LAYOUT, /setNotificacionesDrawer\(\s*conMarcasPendientes\(\[/);
});
