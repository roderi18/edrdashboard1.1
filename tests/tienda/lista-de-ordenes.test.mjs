import fs from 'node:fs';
import test from 'node:test';
import path from 'node:path';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

// LA LISTA DE PEDIDOS, REFORMADA.
//
// Lo que estos casos vigilan no es como se ve, sino que la lista siga diciendo
// la verdad: que los estados salgan de un solo sitio, que lo que se busca se
// encuentre y que lo que se descarga sea lo que se esta mirando.

const leer = (relativa) => fs.readFileSync(path.join(process.cwd(), relativa), 'utf8');

const vista = leer('src/sections/order/view/order-list-view.jsx');
const fila = leer('src/sections/order/order-table-row.jsx');
const navegacion = leer('src/sections/order/order-status-nav.jsx');
const filtros = leer('src/sections/order/order-list-filters.jsx');

test('los estados salen de una sola lista, no de tres copias', () => {
  // Se pintan en tres sitios —la columna de la izquierda, el desplegable de
  // filtros y la etiqueta de cada fila—. Escritos tres veces, el dia que se
  // añada un estado se añade en uno y no en los otros, y las cuentas dejan de
  // cuadrar entre si.
  assert.match(navegacion, /export const ESTADOS_DE_ORDEN = \[/);
  assert.match(filtros, /ESTADOS_DE_ORDEN\.map/);
  assert.match(navegacion, /ESTADOS_DE_ORDEN\.map/);
  // La fila tambien la usa: tenerla escrita alli otra vez era pedir que un
  // pedido cancelado fuera rojo en un sitio y gris en otro.
  assert.match(fila, /import \{ ESTADOS_DE_ORDEN \} from '\.\/order-status-nav';/);
  assert.match(fila, /ESTADOS_DE_ORDEN\.find/);

  // Y las cuentas tambien: "Todos" es el total, no un estado mas.
  assert.match(navegacion, /export const contarPorEstado/);
  assert.match(navegacion, /estado\.value === 'all'\s*\n?\s*\? ordenes\.length/);
  assert.match(vista, /contarPorEstado\(visibleTableData\)/);
});

test('se busca tambien por producto, que es como se pregunta', () => {
  // "El pedido de las camisas". Antes solo entraban el numero y el nombre de
  // quien compro: buscar "camisa" no devolvia nada y parecia que no estaba.
  assert.match(vista, /\.\.\.\(order\.items \|\| \[\]\)\.map\(\(item\) => item\.name\)/);
  assert.match(filtros, /Buscar por número de pedido, producto/);
});

test('el filtro de pago ofrece lo mismo que enseña la columna Total', () => {
  // El desplegable ofrecia tres formas y la columna cuatro —PayPal faltaba—,
  // asi que habia pedidos que se veian en la lista y no habia manera de
  // aislarlos. Un catalogo y no dos.
  assert.match(filtros, /export const METODOS_DE_PAGO = \[/);
  assert.match(filtros, /value: 'paypal', label: 'PayPal'/);
  assert.match(
    filtros,
    /\.\.\.METODOS_DE_PAGO\.map\(\(\{ value, label \}\) => \(\{ value, label \}\)\)/
  );

  // La fila escribe la etiqueta con el mismo catalogo…
  assert.match(fila, /import \{ metodoDePago \} from '\.\/order-list-filters';/);
  // …y el filtro compara por el, no por el texto guardado.
  assert.match(vista, /metodoDePago\(order\.payment\)\.value === payment/);

  // `alias` recoge como llega el dato: marca en los de ejemplo, ingles desde la
  // pasarela.
  assert.match(filtros, /alias: \['tarjeta', 'card', 'visa', 'mastercard'\]/);
  assert.match(filtros, /alias: \['efectivo', 'cash'\]/);
});

test('el aviso de descargar no se queda encima del menu', () => {
  // El menu se abre justo debajo del puntero, asi que el raton nunca sale del
  // boton y el globo se quedaba flotando sobre las opciones, tapando "Excel".
  assert.match(vista, /open=\{avisoDeDescarga\}/);
  assert.match(vista, /onClick=\{\(\) => setAvisoDeDescarga\(false\)\}/);
});

test('el orden elegido se aplica al final, ya filtrado', () => {
  // Ordenar antes y filtrar despues da el mismo resultado recorriendo mas filas
  // de las que hacen falta.
  assert.match(vista, /const ordenaciones = \{/);
  assert.match(vista, /recientes: porFecha/);
  assert.match(vista, /mayor: \(uno, otro\) => importe\(otro\) - importe\(uno\)/);
  assert.match(vista, /return ordenaciones\[orden\] \? \[\.\.\.inputData\]\.sort/);
});

test('lo que se descarga es lo que se esta mirando', () => {
  // Descargar la tabla entera cuando en pantalla hay un filtro puesto es la
  // forma mas rapida de mandar a alguien un listado que no pidio.
  assert.match(vista, /rows=\{dataFiltered\}/);
  // Y vive al final de la fila de filtros, que es cuando se usa: "esto es lo
  // que quiero, dámelo en una hoja". Solo el icono, centrado.
  assert.match(vista, /acciones=\{/);
  assert.match(vista, /buttonLabel=""/);
  assert.match(vista, /'& \.MuiButton-startIcon': \{ m: 0 \}/);
});

test('la fila enseña el pedido, no a quien lo hizo', () => {
  // En `/order` cada quien ve los suyos: el nombre repetido en cuarenta y seis
  // filas no distingue una de otra. Lo que si distingue es que lleva dentro.
  assert.match(fila, /productos\.length === 1 \? 'producto' : 'productos'/);
  assert.doesNotMatch(vista, /label: 'Miembro'/);

  // Y "Ver detalles" con todas sus letras: estaba escondido tras los tres
  // puntos, que es donde vive lo que casi nunca se usa.
  assert.match(fila, />\s*Ver detalles\s*</);
});

test('la lista tiene tope de ancho, para que el zoom aleje y no ensanche', () => {
  // Sin tope, alejar el zoom no alejaba la pagina: la ensanchaba. El contenedor
  // crecia hasta el nuevo ancho de la ventana y la tabla se estiraba, con las
  // filas cada vez mas vacias. Con tope, el bloque conserva su tamaño.
  // El tope va en `sx` y no en `maxWidth`: esa prop solo se aplica con el
  // "diseño compacto" encendido en Ajustes, que cada quien tiene como quiere.
  assert.match(vista, /sx=\{\{ maxWidth: 1600, mx: 'auto' \}\}/);
});

test('los filtros estan siempre, sin boton que los esconda', () => {
  // "Filtros" escondia detras de un clic lo que se usa nada mas entrar, y
  // obligaba a recordar si estaba abierto o cerrado para saber por que la lista
  // enseñaba lo que enseñaba.
  assert.doesNotMatch(vista, /panelDeFiltros/);
  assert.doesNotMatch(vista, /<Collapse/);
  assert.match(vista, /<OrderListFilters/);
});

test('los estados se eligen en un solo sitio', () => {
  // Las pastillas de arriba decian exactamente lo mismo que la columna de la
  // izquierda; dos mandos para la misma eleccion obligan a mirar los dos para
  // saber cual esta puesto.
  assert.doesNotMatch(vista, /renderPastillasDeEstado/);
  assert.match(vista, /<OrderStatusNav/);
});

test('el estado filtrado se escribe como en la columna', () => {
  // Se pintaba el valor tal cual y salia "Pending" en una pantalla en español,
  // al lado de una lista que dice "Pendiente".
  const resultado = leer('src/sections/order/order-table-filters-result.jsx');

  assert.match(
    resultado,
    /ESTADOS_DE_ORDEN\.find\(\(estado\) => estado\.value === currentFilters\.status\)\?\.label/
  );
  assert.match(resultado, /resetLabel="Limpiar"/);
  assert.doesNotMatch(resultado, /label=\{currentFilters\.status\}/);
});

test('las fechas usan el calendario del proyecto', () => {
  // Regla de la casa: el nativo cambia de forma en cada sistema, y aqui ademas
  // convive con campos de MUI.
  assert.match(filtros, /import \{ DatePicker \} from '@mui\/x-date-pickers\/DatePicker';/);
  assert.match(filtros, /format="DD\/MM\/YYYY"/);
  assert.doesNotMatch(filtros, /type="date"/);
});

test('se dice cuantos pedidos se estan viendo y de cuantos', () => {
  // La paginacion sola dice "1-5" y hay que deducir el resto.
  assert.match(vista, /Mostrando \$\{table\.page \* table\.rowsPerPage \+ 1\}/);
  assert.match(vista, /de \$\{dataFiltered\.length\} órdenes/);
});

test('el metodo de pago se dice por lo que es, no por la marca', () => {
  // "Mastercard" contestaba a una pregunta que nadie hace en una lista de
  // pedidos: lo que se busca es si se pago con tarjeta, en efectivo o por
  // transferencia. La marca sigue en la ficha del pedido.
  assert.match(filtros, /value: 'tarjeta',\s*\n\s*label: 'Tarjeta',/);
  assert.match(filtros, /value: 'efectivo',\s*\n\s*label: 'Efectivo',/);
  assert.match(filtros, /icono: 'payments:paypal'/);
});

test('de la tarjeta solo se enseñan los cuatro ultimos digitos', () => {
  // El numero entero ocupaba media columna para decir lo mismo, y ademas no
  // tiene por que estar en una lista que se mira en pantalla compartida.
  assert.match(fila, /const ultimosCuatro = \(numero\) => \{/);
  assert.match(fila, /digitos\.length >= 4 \? `•••• \$\{digitos\.slice\(-4\)\}` : ''/);
  assert.doesNotMatch(fila, /\$\{row\.payment\.cardNumber\}`/);
});

test('las fotos de los productos van de izquierda a derecha', () => {
  // `AvatarGroup` apila al reves y pone el sobrante DELANTE: la primera foto
  // quedaba a la derecha y el "+3" abria la fila.
  assert.doesNotMatch(fila, /<AvatarGroup/);
  assert.match(fila, /productos\.slice\(0, FOTOS_VISIBLES\)\.map/);
  // Y el sobrante se escribe "2+", que se lee de corrido con las fotos que
  // tiene al lado: tres fotos y dos mas.
  assert.match(fila, /const FOTOS_VISIBLES = 3;/);
  assert.match(fila, /\{productos\.length - FOTOS_VISIBLES\}\+/);
});

test('la columna Fecha no repite que es una fecha', () => {
  // Un icono de calendario en una columna llamada "Fecha", encima de una fecha,
  // solo se come el ancho.
  assert.doesNotMatch(fila, /solar:calendar-mark-bold/);
});

test('los colores son los del proyecto, no los de la plantilla', () => {
  // "Todos" salia en el cian de `info`, que no es un color de la casa —la
  // identidad es el verde de Exploradores— y encima competia con los estados,
  // que si usan el color para decir algo.
  assert.match(navegacion, /value: 'all', label: 'Todos', color: 'primary'/);
  assert.doesNotMatch(navegacion, /color: 'info'/);
  // Y el resto son los del tema: amarillo lo que espera, verde lo hecho, rojo
  // lo que se cayo.
  assert.match(navegacion, /value: 'pending'.*color: 'warning'/);
  assert.match(navegacion, /value: 'completed'.*color: 'success'/);
  assert.match(navegacion, /value: 'cancelled'.*color: 'error'/);
});

test('la columna de estados respira entre sus dos tarjetas', () => {
  // El `spacing` del `Stack` se reparte con el `gap` de flex; la vista le pasaba
  // `display: block` para ocultarla en movil y con eso ese `gap` dejaba de
  // existir: las dos tarjetas salian pegadas por mucho `spacing` que tuvieran.
  assert.match(navegacion, /<Stack spacing=\{3\} sx=\{sx\}>/);
  assert.match(vista, /display: \{ xs: 'none', lg: 'flex' \}/);
  assert.doesNotMatch(vista, /display: \{ xs: 'none', lg: 'block' \}/);
});

test('todas las etiquetas de estado miden lo mismo', () => {
  // Ajustadas al texto, "Pendiente" y "Reembolsado" empezaban en el mismo sitio
  // pero terminaban en dos distintos: la columna quedaba con el borde derecho
  // en zigzag.
  assert.match(fila, /const ANCHO_DE_ETIQUETA = \d+;/);
  assert.match(fila, /sx=\{\{ width: ANCHO_DE_ETIQUETA, justifyContent: 'flex-start' \}\}/);
});
