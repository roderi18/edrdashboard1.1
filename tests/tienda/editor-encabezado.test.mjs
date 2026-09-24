import fs from 'node:fs';
import test from 'node:test';
import path from 'node:path';
import assert from 'node:assert/strict';
import { register } from 'node:module';

// El codigo REAL, por el mismo alias con el que lo importa la aplicacion.
register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

const {
  PALETA,
  LIMITES,
  fondoACss,
  sanearColor,
  sanearTexto,
  crearElemento,
  sanearDiseno,
  elementoACss,
  sanearUrlImagen,
  LOGO_POR_DEFECTO,
  disenoDesdeEncabezado,
  figuraACss,
  TIPOS_DE_ELEMENTO,
  EFECTOS,
  efectoACss,
  sanearElemento,
  estaVigente,
  sanearFecha,
  tiempoRestante,
  formatearCuenta,
  elementosVisibles,
  FORMATOS_DE_CUENTA,
} = await import('src/utils/store-header-design.mjs');

const modelo = await import('src/utils/store-header-design.mjs');

// EL EDITOR VISUAL DEL ENCABEZADO DE LA TIENDA.
//
// Lo que estos casos vigilan no es como se ve, sino QUE SE PUEDE GUARDAR. El
// diseño lo escribe el Administrador Global y lo LEE todo el que entra a la
// tienda: un campo sin acotar seria una via para meter estilos —o algo peor— en
// la pantalla de los demas.

const leer = (relativa) => fs.readFileSync(path.join(process.cwd(), relativa), 'utf8');

test('el color solo pasa si es hexadecimal', () => {
  assert.equal(sanearColor('#ff0000'), '#FF0000');
  assert.equal(sanearColor('#FF0000AA'), '#FF0000AA');

  // Un color es un valor de CSS: aceptar cadenas libres es aceptar esto.
  assert.equal(sanearColor('url(https://ajeno.example/x.png)', '#FFFFFF'), '#FFFFFF');
  assert.equal(sanearColor('red; background: url(x)', '#FFFFFF'), '#FFFFFF');
  assert.equal(sanearColor('expression(alert(1))', '#FFFFFF'), '#FFFFFF');
  assert.equal(sanearColor('', '#212B36'), '#212B36');
});

test('el texto es texto plano, de una linea y con tope', () => {
  assert.equal(sanearTexto('  Hola  '), 'Hola');
  // Sin saltos de linea: un texto de varias lineas descoloca el bloque entero.
  assert.equal(sanearTexto('uno\ndos'), 'uno dos');
  assert.equal(sanearTexto('x'.repeat(500)).length, LIMITES.texto);
  // No se interpreta como marcado: se guarda tal cual y React lo pinta escapado.
  assert.equal(sanearTexto('<img src=x onerror=alert(1)>'), '<img src=x onerror=alert(1)>');
});

test('los numeros se recortan al rango util, no solo a "es un numero"', () => {
  const diseno = sanearDiseno({
    activo: true,
    altura: 99999,
    elementos: [{ texto: 'Grande', tamano: 4000, x: -80, y: 500, ancho: 900 }],
  });

  // Un tamaño de 4000 tapa la pantalla igual que un ataque.
  assert.equal(diseno.altura, LIMITES.altura.max);
  assert.equal(diseno.elementos[0].tamano, LIMITES.tamano.max);
  assert.equal(diseno.elementos[0].x, LIMITES.posicion.min);
  assert.equal(diseno.elementos[0].y, LIMITES.posicion.max);
  assert.equal(diseno.elementos[0].ancho, LIMITES.ancho.max);
});

test('lo que no se reconoce cae al valor por defecto, no se guarda a medias', () => {
  const diseno = sanearDiseno({
    fondo: { tipo: 'javascript:alert(1)', color: 'rojo' },
    elementos: [{ alineacion: 'justify', tamano: 'grande' }],
  });

  assert.equal(diseno.fondo.tipo, 'degradado');
  assert.equal(diseno.fondo.color, '#004B50');
  assert.equal(diseno.elementos[0].alineacion, 'left');
  assert.equal(diseno.elementos[0].tamano, 24);
});

test('un diseño vacio o roto no revienta la portada', () => {
  for (const entrada of [undefined, null, 'texto', 42, { elementos: 'no es lista' }]) {
    const diseno = sanearDiseno(entrada);

    assert.equal(diseno.activo, false);
    assert.deepEqual(diseno.elementos, []);
  }
});

test('hay un tope de textos: cada uno se pinta en la pantalla de todos', () => {
  const muchos = Array.from({ length: 200 }, (_, indice) => ({ texto: `t${indice}` }));

  assert.equal(sanearDiseno({ elementos: muchos }).elementos.length, LIMITES.elementos);
});

test('cada texto nuevo lleva identificador propio', () => {
  // Si fuera el indice, reordenar o borrar reasignaria el formato de otro.
  const uno = crearElemento({ texto: 'A' });
  const otro = crearElemento({ texto: 'A' });

  assert.notEqual(uno.id, otro.id);
  assert.match(uno.id, /^[a-zA-Z0-9_-]+$/);
});

test('el fondo se pinta como imagen en sus tres formas', () => {
  assert.match(fondoACss({ tipo: 'plano', color: '#FF5630' }), /^linear-gradient\(0deg/);
  assert.match(fondoACss({ tipo: 'degradado', angulo: 90 }), /^linear-gradient\(90deg/);
  assert.match(fondoACss({ tipo: 'sombra' }), /^radial-gradient/);
  // La opacidad se escribe en el color, para que la foto asome por debajo.
  assert.match(fondoACss({ tipo: 'plano', color: '#000000', opacidad: 0.5 }), /#00000080/);
});

test('todo se mide en el lienzo de diseño, y el lienzo entero se encoge', () => {
  // Antes cada cosa tenia su regla: el texto encogia con `vw`, las imagenes iban
  // en porcentaje y el alto estaba fijo en pixeles. Tres reglas para tres cosas
  // que tienen que moverse juntas, y al estrechar la ventana el diseño se
  // descuadraba en vez de hacerse pequeño.
  assert.equal(elementoACss({ tamano: 48 }).fontSize, '48px');
  // Se mira el CODIGO, no los comentarios: uno de ellos cuenta justamente por
  // que se quito el `clamp`.
  const modeloSinComentarios = leer('src/utils/store-header-design.mjs')
    .split('\n')
    .filter((linea) => !/^\s*(\/\/|\*|\/\*)/.test(linea))
    .join('\n');

  assert.doesNotMatch(modeloSinComentarios, /clamp\(/);

  const lienzo = leer('src/components/header-visual-editor/header-visual-canvas.jsx');

  assert.match(
    lienzo,
    /const escala = anchoDisponible > 0 \? anchoDisponible \/ ANCHO_DE_REFERENCIA : 1;/
  );
  assert.match(lienzo, /transform: `scale\(\$\{escala\}\)`/);
  // El alto sale de la escala: se estrecha y se acorta a la vez.
  assert.match(lienzo, /height: seguro\.altura \* escala/);
  assert.match(lienzo, /width: ANCHO_DE_REFERENCIA/);
});

test('ajustar al texto mide en el lienzo, no en la pantalla', () => {
  // `getComputedStyle` devuelve el tamaño ANTES de encoger el lienzo: con el
  // ancho de pantalla, el recuadro salia mas estrecho cuanto mas pequeña fuera
  // la ventana.
  const editor = leer('src/components/header-visual-editor/header-visual-editor.jsx');

  assert.match(editor, /const ancho = \(\(natural \+ 4\) \/ ANCHO_DE_REFERENCIA\) \* 100;/);
});

test('las posiciones van en porcentaje, nunca en pixeles', () => {
  const estilos = elementoACss({ x: 40, y: 25, ancho: 30 });

  assert.equal(estilos.left, '40%');
  assert.equal(estilos.top, '25%');
  assert.equal(estilos.width, '30%');
});

test('la paleta es de colores fijos, no de tokens del tema', () => {
  // El diseño se guarda una vez y lo ve gente con el modo claro y con el
  // oscuro: el color elegido tiene que significar lo mismo en los dos.
  assert.ok(PALETA.length > 0);
  PALETA.forEach((color) => assert.equal(sanearColor(color), color));
});

test('el parpadeo se apaga con prefers-reduced-motion', () => {
  // No es un adorno opcional: algo que late en la cabecera es motivo para
  // cerrar la pantalla si tienes sensibilidad vestibular o migrañas.
  // El movimiento no se escribe en el lienzo: sale de `efectoACss`, que lleva
  // el apagado dentro. Asi la muestra del editor y el encabezado se apagan por
  // la misma regla.
  const modelo = leer('src/utils/store-header-design.mjs');

  assert.match(modelo, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(modelo, /animation: 'none'/);
});

test('el cliente y el editor pintan con el mismo componente', () => {
  // Si fueran dos, el editor enseñaria una cosa y la tienda otra.
  const editor = leer('src/components/header-visual-editor/header-visual-editor.jsx');
  const portada = leer('src/sections/product/store-header.jsx');

  assert.match(editor, /<HeaderVisualCanvas/);
  assert.match(portada, /<HeaderVisualCanvas/);
});

test('los controles solo existen para quien puede editar', () => {
  const portada = leer('src/sections/product/store-header.jsx');

  // El lapiz y el editor cuelgan de `puedeEditar`, que es `isAdminGlobal`.
  assert.match(
    portada,
    /const puedeEditar = isAdminGlobal\(user\) \|\| canManageStoreProducts\(user\);/
  );
  assert.match(portada, /\{puedeEditar && \(\s*\n?\s*<IconButton/);
  // Y "Avanzados" vive dentro del dialogo, que ya solo abre el lapiz.
  assert.match(portada, /Avanzados/);
  assert.match(portada, /setEditandoDiseno\(true\)/);
});

test('el diseño se guarda saneado y queda en Historial', () => {
  const servicio = leer('src/services/store-settings-service.js');

  // Se sanea AL LEER tambien: lo guardado pudo entrar por otra via.
  assert.match(servicio, /disenoAvanzado: sanearDiseno\(datos\?\.disenoAvanzado\)/);
  assert.match(servicio, /etiqueta: 'Diseño avanzado'/);
  assert.match(servicio, /ambito: AMBITOS_CAMBIO\.tienda/);
});

test('el diseño nace apagado: encenderlo es una decision', () => {
  const servicio = leer('src/services/store-settings-service.js');

  assert.equal(sanearDiseno({}).activo, false);
  assert.match(servicio, /disenoAvanzado: DISENO_POR_DEFECTO/);
});

test('el arrastre no llena el historial', () => {
  // Con una entrada por pixel, deshacer retrocedia un pixel: hacian falta
  // cuarenta pulsaciones para dejar el texto donde estaba.
  const historial = leer('src/components/header-visual-editor/use-diseno-historial.js');

  assert.match(historial, /const fusionar = etiqueta !== null && gesto\.current === etiqueta;/);
  assert.match(historial, /if \(!fusionar\) setPasado/);
  assert.match(historial, /restaurar/);
});

test('se puede colocar sin raton', () => {
  // Un editor que solo entiende el arrastre deja fuera a quien no puede
  // arrastrar.
  const editor = leer('src/components/header-visual-editor/header-visual-editor.jsx');

  assert.match(editor, /ArrowLeft/);
  assert.match(editor, /ArrowRight/);
  assert.match(editor, /tabIndex=\{0\}/);
  assert.match(editor, /aria-label=\{[\s\S]{0,160}Mover el texto/);
});

test('avanzados abre con lo que ya se estaba viendo, no en blanco', () => {
  // Quien pulsa "Avanzados" viene a mover lo que hay, no a escribirlo otra vez.
  const diseno = disenoDesdeEncabezado({
    titulo: 'Exploradores del Rey',
    subtitulo: 'Equipando hoy a los líderes del mañana',
    disposicion: 'franja',
    pieTitulo: 'República Dominicana',
  });

  const textos = diseno.elementos.filter((item) => item.tipo === 'texto').map((item) => item.texto);

  assert.equal(diseno.activo, true);
  assert.ok(textos.includes('Exploradores del Rey'));
  assert.ok(textos.includes('Equipando hoy a los líderes del mañana'));
  assert.ok(textos.includes('República Dominicana'));
  assert.ok(textos.includes('TIENDA OFICIAL'));
});

test('el escudo entra como un elemento mas, movible y cambiable', () => {
  // Era lo unico del encabezado que no se podia ni mover ni cambiar.
  const diseno = disenoDesdeEncabezado({ titulo: 'Tienda' });
  const logo = diseno.elementos.find((item) => item.tipo === 'imagen');

  assert.ok(logo, 'el escudo se coloca en el lienzo');
  assert.equal(logo.url, LOGO_POR_DEFECTO);

  const editor = leer('src/components/header-visual-editor/header-visual-editor.jsx');
  assert.match(editor, /Cambiar imagen/);
  // Subir no es asunto del editor: lo resuelve quien lo usa.
  assert.match(editor, /onSubirImagen/);
  assert.match(
    leer('src/sections/product/store-header.jsx'),
    /encabezado-elemento-\$\{Date\.now\(\)\}\.webp/
  );
});

test('la disposicion clasica no coloca el pie del titulo', () => {
  // En la clasica ese texto no se lee en ningun sitio: colocarlo seria inventar.
  const diseno = disenoDesdeEncabezado({
    titulo: 'Tienda',
    subtitulo: 'Lema',
    disposicion: 'clasica',
    pieTitulo: 'República Dominicana',
  });

  const textos = diseno.elementos.map((item) => item.texto);

  assert.ok(!textos.includes('República Dominicana'));
});

test('con foto, la semilla pone un velo que la deja ver', () => {
  const conFoto = disenoDesdeEncabezado({ titulo: 'Tienda', fotoUrl: 'https://x.test/a.webp' });
  const sinFoto = disenoDesdeEncabezado({ titulo: 'Tienda' });

  assert.ok(conFoto.fondo.opacidad < 1);
  // Sin foto se conserva el degradado de siempre: encender el editor no cambia
  // el aspecto de la portada por su cuenta.
  assert.equal(sinFoto.fondo.opacidad, 1);
  assert.equal(sinFoto.fondo.color, '#004B50');
});

test('una imagen solo se pinta si su direccion es del sitio o https', () => {
  assert.equal(
    sanearUrlImagen('/logo/exploradores-del-rey-logo.png'),
    '/logo/exploradores-del-rey-logo.png'
  );
  assert.equal(
    sanearUrlImagen('https://firebasestorage.googleapis.com/v0/b/x/o/y.webp'),
    'https://firebasestorage.googleapis.com/v0/b/x/o/y.webp'
  );

  // `data:` sirve para colar un SVG con script dentro; `javascript:` no hace
  // falta explicarlo. Y `http` a secas rompe la pagina segura.
  assert.equal(sanearUrlImagen('javascript:alert(1)'), '');
  assert.equal(sanearUrlImagen('data:image/svg+xml;base64,PHN2Zz48c2NyaXB0Lz48L3N2Zz4='), '');
  assert.equal(sanearUrlImagen('http://ajeno.example/x.png'), '');

  // Y sin direccion valida no se pinta ningun <img> roto en la portada.
  assert.match(
    leer('src/components/header-visual-editor/header-visual-canvas.jsx'),
    /if \(elemento\.tipo === 'imagen' && !elemento\.url\) return null;/
  );
});

test('el texto acepta emojis y no los parte al recortar', () => {
  // El tope se cuenta en caracteres de verdad: un emoji ocupa dos unidades del
  // motor —y una bandera, cuatro—, asi que `slice` dejaba un simbolo roto.
  assert.equal(sanearTexto('¡Oferta! 🔥🎉'), '¡Oferta! 🔥🎉');
  assert.equal(sanearTexto('🇩🇴 República'), '🇩🇴 República');

  const largo = sanearTexto('🔥'.repeat(400));

  assert.equal(Array.from(largo).length, LIMITES.texto);
  // Ni un solo trozo suelto: todo lo que queda son emojis completos.
  assert.ok(!/�/.test(largo));
  assert.deepEqual([...new Set(Array.from(largo))], ['🔥']);
});

test('las promociones no se parten en silabas', () => {
  // "¡Oferta!" salia como "¡Ofert / a!" en un bloque estrecho.
  const lienzo = leer('src/components/header-visual-editor/header-visual-canvas.jsx');

  assert.match(lienzo, /wordBreak: 'keep-all'/);
  assert.doesNotMatch(lienzo, /wordBreak: 'break-word'/);

  // Y el texto parpadeante nace ancho, no en un bloque de 20.
  const dialogo = leer('src/components/header-visual-editor/texto-parpadeante-dialogo.jsx');
  assert.match(dialogo, /ancho: 34/);
});

test('lo que se esta editando no parpadea', () => {
  // Con el texto latiendo no hay forma de arrastrarlo ni de leer lo que dice;
  // el efecto se comprueba con el ojo de previsualizar.
  const editor = leer('src/components/header-visual-editor/header-visual-editor.jsx');
  const lienzo = leer('src/components/header-visual-editor/header-visual-canvas.jsx');

  assert.match(editor, /animaciones=\{previsualizando\}/);
  assert.match(lienzo, /animaciones \? efectoACss\(elemento\) : null/);
});

test('hay cinco efectos y se guarda cual, no una mezcla de banderas', () => {
  // Antes eran dos interruptores que se podian encender a la vez y daban
  // resultados que nadie eligio. Un efecto es UNO.
  assert.deepEqual(
    EFECTOS.map((efecto) => efecto.id),
    [
      'ninguno',
      'parpadeo',
      'pulso',
      'colores-derecha',
      'colores-izquierda',
      'colores-vertical',
      'neon',
    ]
  );

  const diseno = sanearDiseno({
    elementos: [
      { texto: 'A', efecto: 'pulso' },
      { texto: 'B', efecto: 'inventado' },
    ],
  });

  assert.equal(diseno.elementos[0].efecto, 'pulso');
  assert.equal(diseno.elementos[1].efecto, 'ninguno');
});

test('los diseños guardados con las banderas viejas siguen viendose igual', () => {
  // `parpadeo` era el clasico y `multicolor` el de colores hacia la derecha: un
  // encabezado guardado hace meses no puede quedarse quieto de golpe.
  assert.equal(sanearElemento({ parpadeo: true }).efecto, 'parpadeo');
  assert.equal(sanearElemento({ multicolor: true }).efecto, 'colores-derecha');
  assert.equal(sanearElemento({}).efecto, 'ninguno');
  // Y lo elegido a mano manda sobre las banderas heredadas.
  assert.equal(sanearElemento({ parpadeo: true, efecto: 'pulso' }).efecto, 'pulso');
});

test('cada efecto se mueve como dice su nombre', () => {
  assert.equal(efectoACss({ efecto: 'ninguno' }), null);

  assert.match(efectoACss({ efecto: 'parpadeo', velocidad: 1 }).animation, /efectoParpadeo 1s/);
  // El pulso crece y respira: no es un parpadeo mas lento.
  assert.match(efectoACss({ efecto: 'pulso' }).animation, /efectoPulso/);
  assert.equal(
    efectoACss({ efecto: 'pulso' })['@keyframes efectoPulso']['50%'].transform,
    'scale(1.06)'
  );

  // La izquierda es la derecha del reves; el vertical va y vuelve.
  assert.doesNotMatch(efectoACss({ efecto: 'colores-derecha' }).animation, /reverse/);
  assert.match(efectoACss({ efecto: 'colores-izquierda' }).animation, /reverse/);
  assert.match(efectoACss({ efecto: 'colores-vertical' }).animation, /alternate/);
  assert.equal(
    efectoACss({ efecto: 'colores-vertical' })['@keyframes efectoColores']['100%']
      .backgroundPosition,
    '0 200%'
  );

  // La velocidad se acota: muy rapido deja de leerse y ademas molesta de verdad.
  assert.match(efectoACss({ efecto: 'parpadeo', velocidad: 99 }).animation, /4s/);
});

test('todos los efectos se detienen con prefers-reduced-motion', () => {
  // Ni uno se escapa: es la regla, no una opcion de cada efecto.
  EFECTOS.filter((efecto) => efecto.id !== 'ninguno').forEach((efecto) => {
    const css = efectoACss({ efecto: efecto.id });

    assert.equal(css['@media (prefers-reduced-motion: reduce)'].animation, 'none', efecto.id);
  });
});

test('el efecto de color pinta el degradado en la direccion que toca', () => {
  const derecha = elementoACss({
    efecto: 'colores-derecha',
    color: '#FFAB00',
    colorSecundario: '#FF5630',
  });
  const vertical = elementoACss({ efecto: 'colores-vertical' });

  assert.match(derecha.backgroundImage, /^linear-gradient\(90deg/);
  assert.equal(derecha.color, 'transparent');
  assert.equal(derecha.backgroundSize, '200% 100%');

  assert.match(vertical.backgroundImage, /^linear-gradient\(180deg/);
  assert.equal(vertical.backgroundSize, '100% 200%');

  // Sin efecto de color no se recorta nada: el texto lleva su color de siempre.
  assert.equal(elementoACss({ efecto: 'parpadeo', color: '#FFFFFF' }).color, '#FFFFFF');
});

test('el texto parpadeante se elige viendolo, no por su nombre', () => {
  // "Pulso suave" y "colores en vertical" solo se distinguen mirandolos.
  const dialogo = leer('src/components/header-visual-editor/texto-parpadeante-dialogo.jsx');
  const editor = leer('src/components/header-visual-editor/header-visual-editor.jsx');

  assert.match(editor, /Texto parpadeante/);
  assert.doesNotMatch(editor, /Promoción/);
  assert.match(editor, /<TextoParpadeanteDialogo/);

  // La muestra se pinta con las MISMAS funciones que el encabezado: si se
  // dibujara aparte, elegir por ella seria elegir a ciegas.
  assert.match(dialogo, /efectoACss\(muestra\)/);
  assert.match(dialogo, /elementoACss\(muestra\)/);
  // Y con el texto, los colores y la velocidad que se estan configurando.
  assert.match(dialogo, /sanearElemento\(\{ \.\.\.borrador, efecto: efecto\.id \}\)/);
  assert.match(dialogo, /label="Texto"/);
  assert.match(dialogo, /Velocidad/);
});

test('el subrayado es una opcion mas del texto', () => {
  assert.equal(elementoACss({ subrayado: true }).textDecoration, 'underline');
  assert.equal(elementoACss({}).textDecoration, 'none');
  assert.match(
    leer('src/components/header-visual-editor/header-visual-editor.jsx'),
    /value="subrayado"/
  );
});

test('se pueden poner lineas y formas, no solo textos', () => {
  // Un rotulo se arma separando y enmarcando, no solo escribiendo.
  assert.deepEqual(TIPOS_DE_ELEMENTO, ['texto', 'imagen', 'linea', 'forma', 'cuenta']);

  const linea = figuraACss({ tipo: 'linea', grosor: 4, color: '#FFFFFF' });
  assert.equal(linea.height, '4px');

  const circulo = figuraACss({ tipo: 'forma', forma: 'circulo', alto: 20 });
  assert.equal(circulo.borderRadius, '50%');
  assert.equal(circulo.height, '20%');

  const editor = leer('src/components/header-visual-editor/header-visual-editor.jsx');
  // Las tres salen del mismo flotante de "Formas".
  assert.match(
    editor,
    /agregarFigura\(opcion\.forma === 'linea' \? 'linea' : 'forma', opcion\.forma\)/
  );
});

test('el control de tamaño esta en la barra, junto al ojo', () => {
  // Es lo que mas se toca; tenerlo solo en el panel obligaba a cruzar la
  // pantalla para probar "mas grande / ver como queda".
  const editor = leer('src/components/header-visual-editor/header-visual-editor.jsx');
  const barra = editor.slice(
    editor.indexOf('const renderBarra'),
    editor.indexOf('const renderPaleta')
  );

  assert.match(barra, /value="previsualizar"/);
  assert.match(barra, /'tamano-barra'/);
});

test('la portada la edita el Administrador Global y el de la tienda', () => {
  const portada = leer('src/sections/product/store-header.jsx');
  const reglasFirestore = leer('firestore.rules');
  const reglasStorage = leer('storage.rules');

  assert.match(portada, /isAdminGlobal\(user\) \|\| canManageStoreProducts\(user\)/);

  // Y no solo en pantalla: las reglas tienen que dejarle escribir, o el boton
  // existe y el guardado muere en el servidor.
  assert.match(
    reglasFirestore,
    /allow write: if esAdministradorGlobal\(\) \|\| esAdministradorDeTienda\(\);/
  );
  assert.match(reglasFirestore, /rolDelToken\(\) == 'administrador_tienda'/);
  assert.match(reglasStorage, /esAdministradorGlobal\(\) \|\| esAdministradorDeTienda\(\)/);
  assert.match(reglasStorage, /'administrador_tienda'/);
});

test('un clic o un toque dejan el elemento seleccionado', () => {
  // El panel de formato solo se veia mientras se mantenia pulsado: el `click`
  // llegaba al lienzo y deseleccionaba justo al soltar. `stopPropagation` en el
  // `pointerdown` no detiene el `click`, que se dispara despues.
  const editor = leer('src/components/header-visual-editor/header-visual-editor.jsx');

  assert.match(editor, /if \(event\.target === event\.currentTarget\) setSeleccionado\(null\);/);
  assert.match(editor, /event\.stopPropagation\(\);\s*\n\s*setSeleccionado\(item\.id\);/);
});

test('el lapiz abre tambien con un diseño guardado', () => {
  // La portada con diseño libre era un `return` propio y con el se iba el
  // dialogo: el lapiz alternaba un estado que ya no pintaba nadie.
  const portada = leer('src/sections/product/store-header.jsx');

  assert.match(portada, /const renderPortadaConDiseno = \(\) => \(/);
  assert.match(portada, /\{disenoActivo \? renderPortadaConDiseno\(\) : renderPortadaSimple\(\)\}/);
  // Un solo sitio donde vive el dialogo, fuera de las formas del encabezado.
  assert.equal(portada.match(/<Dialog[\s>]/g).length, 1);
});

test('revertir se pregunta antes de hacerlo, y ofrece dos destinos', () => {
  const portada = leer('src/sections/product/store-header.jsx');

  assert.match(portada, /<ConfirmDialog/);
  assert.match(portada, /Volver al diseño anterior/);
  assert.match(portada, /Diseño de fábrica/);
  // El boton vive en la barra del editor desde que el lapiz abre el editor
  // directamente; el menu y la confirmacion siguen aqui.
  const editor = leer('src/components/header-visual-editor/header-visual-editor.jsx');
  assert.match(editor, />\s*Reversar\s*</);
  assert.match(editor, /onClick=\{onReversar\}/);
  assert.doesNotMatch(portada, /Volver al encabezado simple/);
  // Sin un cambio anterior, esa salida no se ofrece.
  assert.match(portada, /disabled=\{!encabezado\.anterior\}/);
});

test('la version anterior se guarda para poder volver a ella', () => {
  const servicio = leer('src/services/store-settings-service.js');

  // El Historial dice QUE cambio; para devolver la portada hacen falta los
  // valores, y por eso viajan en el propio documento.
  assert.match(servicio, /const instantaneaDelEncabezado = \(encabezado\) => \(\{/);
  assert.match(servicio, /anterior: instantaneaDelEncabezado\(anterior\)/);
  assert.match(
    servicio,
    /anterior: datos\?\.anterior \? conValoresPorDefecto\(datos\.anterior\) : null/
  );

  // Revertir no es una puerta trasera: entra por el mismo guardado, asi que
  // queda en Historial con su autor.
  assert.match(servicio, /async function revertirEncabezadoTiendaDirecto/);
  assert.match(servicio, /return guardarEncabezadoTienda\(actual\.anterior, usuario\);/);
  // Y volver de fabrica no borra la foto: quitarla es otra decision.
  assert.match(servicio, /fotoUrl: actual\.fotoUrl,/);
});

test('las capas deciden quien tapa a quien, y no el orden del array', () => {
  // Duplicar o borrar reordena el array: si el orden viniera de ahi, lo que
  // estaba delante pasaria detras sin que nadie lo tocara.
  const orden = elementosVisibles({
    elementos: [
      { texto: 'fondo', capa: 5 },
      { texto: 'frente', capa: 40 },
      { texto: 'medio', capa: 20 },
    ],
  }).map((elemento) => elemento.texto);

  assert.deepEqual(orden, ['fondo', 'medio', 'frente']);

  // A igual capa manda quien se creo antes, siempre igual: sin esto el diseño
  // cambiaba solo al guardar.
  const empate = elementosVisibles({
    elementos: [
      { texto: 'uno', capa: 10 },
      { texto: 'dos', capa: 10 },
    ],
  }).map((elemento) => elemento.texto);

  assert.deepEqual(empate, ['uno', 'dos']);

  const lienzo = leer('src/components/header-visual-editor/header-visual-canvas.jsx');
  assert.match(lienzo, /zIndex: elemento\.capa/);
});

test('un elemento bloqueado se selecciona pero no se mueve', () => {
  // Es el caso del escudo: se coloca una vez y luego estorba cada vez que se
  // mueve algo que tiene al lado. Bloquear no es ocultar ni impedir editarlo.
  const editor = leer('src/components/header-visual-editor/header-visual-editor.jsx');

  assert.equal(sanearElemento({ bloqueado: true }).bloqueado, true);
  assert.match(editor, /if \(item\.bloqueado\) \{\s*\n\s*setSeleccionado\(item\.id\);/);
  assert.match(editor, /if \(item\.bloqueado\) return;/);
  // Y sin asa de ancho, que seria otra forma de moverlo sin querer.
  assert.match(editor, /\{activo && !item\.bloqueado && \(/);
  // Y el candado se pulsa desde la barra de arriba, no bajando a la columna.
  assert.match(editor, /const renderFilaDePieza = \(\) => \(/);
});

test('el enlace pasa el mismo filtro que las imagenes', () => {
  // Un `javascript:` en la portada seria un agujero para todos los que entran.
  assert.equal(sanearElemento({ enlace: 'javascript:alert(1)' }).enlace, '');
  assert.equal(sanearElemento({ enlace: 'data:text/html,<script>' }).enlace, '');
  assert.equal(sanearElemento({ enlace: '/dashboard/product' }).enlace, '/dashboard/product');
  assert.equal(
    sanearElemento({ enlace: 'https://erd.do/ofertas' }).enlace,
    'https://erd.do/ofertas'
  );
});

test('con enlace se pinta un enlace de verdad, no un div que reacciona', () => {
  // Un `div` con `onClick` no se abre en otra pestaña, no se puede copiar y el
  // teclado no llega a el.
  const lienzo = leer('src/components/header-visual-editor/header-visual-canvas.jsx');

  assert.match(lienzo, /component="a"/);
  assert.match(lienzo, /href=\{elemento\.enlace\}/);
  // Lo externo se abre fuera y con la proteccion de siempre.
  assert.match(lienzo, /rel: 'noopener noreferrer'/);
  assert.match(lienzo, /elemento\.enlace\.startsWith\('http'\)/);
});

test('la programacion decide cuando se ve, y no borra nada', () => {
  const ahora = new Date('2026-09-10T12:00:00Z').getTime();

  assert.equal(estaVigente({}, ahora), true);
  assert.equal(estaVigente({ desde: '2026-09-11T00:00:00Z' }, ahora), false);
  assert.equal(estaVigente({ desde: '2026-09-01T00:00:00Z' }, ahora), true);
  // `hasta` excluido: es como se lee "hasta el viernes".
  assert.equal(estaVigente({ hasta: '2026-09-10T12:00:00Z' }, ahora), false);
  assert.equal(estaVigente({ hasta: '2026-09-10T12:00:01Z' }, ahora), true);

  // Caducada no se borra: se puede volver a usar el año que viene.
  const diseno = sanearDiseno({ elementos: [{ texto: 'vieja', hasta: '2020-01-01T00:00:00Z' }] });
  assert.equal(diseno.elementos.length, 1);
  assert.equal(elementosVisibles(diseno, ahora).length, 0);
  // Y en el editor se ve igual, o se colocaria a ciegas.
  assert.equal(elementosVisibles(diseno, ahora, { todos: true }).length, 1);
});

test('la fecha se guarda como instante en UTC, y media fecha no se guarda', () => {
  // La tienda la miran desde varios husos: una promocion que empieza el viernes
  // tiene que empezar a la vez para todos.
  assert.equal(sanearFecha('2026-09-10T12:00:00Z'), '2026-09-10T12:00:00.000Z');
  assert.equal(sanearFecha('el viernes'), '');
  assert.equal(sanearFecha(''), '');
  // Media fecha es peor que ninguna: dejaria una promocion encendida para
  // siempre.
  assert.equal(sanearElemento({ hasta: 'pronto' }).hasta, '');
});

test('la cuenta regresiva dice lo que falta y para cuando termina', () => {
  const ahora = new Date('2026-09-10T12:00:00Z').getTime();

  assert.equal(formatearCuenta(tiempoRestante('2026-09-11T14:30:05Z', ahora)), '1d 02:30:05');
  // Los dias solo aparecen cuando quedan: "00d 02:14" hace pensar que falta
  // mucho mas de lo que falta.
  assert.equal(formatearCuenta(tiempoRestante('2026-09-10T14:30:05Z', ahora)), '02:30:05');
  assert.equal(tiempoRestante('2020-01-01T00:00:00Z', ahora).terminado, true);
  assert.equal(
    formatearCuenta(tiempoRestante('2020-01-01T00:00:00Z', ahora), '¡Se acabó!'),
    '¡Se acabó!'
  );

  // Y el segundero se para cuando ya no hay nada que contar.
  const cuenta = leer('src/components/header-visual-editor/cuenta-regresiva.jsx');
  assert.match(cuenta, /if \(siguiente\.terminado\) clearInterval\(reloj\);/);
  assert.match(cuenta, /return \(\) => clearInterval\(reloj\);/);
});

test('la promocion aparece sola a su hora, sin recargar', () => {
  // Leer el reloj al pintar ademas dejaba al servidor y al navegador dibujando
  // cosas distintas.
  const lienzo = leer('src/components/header-visual-editor/header-visual-canvas.jsx');

  assert.match(lienzo, /const \[ahora, setAhora\] = useState\(\(\) => Date\.now\(\)\);/);
  assert.match(lienzo, /setInterval\(\(\) => setAhora\(Date\.now\(\)\), 30000\)/);
  assert.doesNotMatch(lienzo, /elementosVisibles\(seguro, Date\.now\(\)/);
});

test('la vista previa estrecha el mismo lienzo, no lo simula', () => {
  // Colocar solo en escritorio y descubrir en el movil que el lema tapa al
  // titulo es el error mas caro de este editor.
  const editor = leer('src/components/header-visual-editor/header-visual-editor.jsx');

  assert.match(editor, /const DISPOSITIVOS = \[/);
  assert.match(editor, /id: 'movil', etiqueta: 'Móvil', ancho: 390/);
  assert.match(editor, /id: 'tableta', etiqueta: 'Tableta', ancho: 820/);
  assert.match(editor, /width: anchoDelDispositivo \|\| 1/);
});

test('las analiticas cuentan dos numeros y no quien miro', () => {
  // La portada la ve todo el que entra —incluidos menores—: un registro con
  // nombres convertiria un contador de carteles en un rastro de navegacion.
  const servicio = leer('src/services/store-header-analytics-service.js');
  const reglas = leer('firestore.rules');

  assert.match(servicio, /impresiones/);
  assert.match(servicio, /clics/);
  // Se mira el CODIGO, no los comentarios: uno de ellos explica justamente por
  // que no se guarda quien miro.
  const codigo = servicio
    .split('\n')
    .filter((linea) => !linea.trimStart().startsWith('//'))
    .join('\n');

  assert.doesNotMatch(codigo, /uid|correo|email|displayName/i);
  // Con `increment`, no leyendo y sumando: dos a la vez perderian una cuenta.
  assert.match(servicio, /increment\(1\)/);

  // Escribe cualquiera que entre, pero SOLO esos campos; leer es de quien
  // administra la tienda.
  assert.match(reglas, /match \/analiticas_encabezado_tienda\/\{idElemento\} \{/);
  assert.match(
    reglas,
    /allow read: if esAdministradorGlobal\(\) \|\| esAdministradorDeTienda\(\);/
  );
  assert.match(reglas, /hasOnly\(\['impresiones', 'clics', 'actualizadoEn'\]\)/);
  // Y el comodin del final no la devuelve a cualquiera.
  assert.match(reglas, /coleccion != 'analiticas_encabezado_tienda'/);
});

test('la impresion se cuenta por lo que se ve, no por cada pintado', () => {
  // React vuelve a pintar por muchos motivos: sin guarda, una sola visita valia
  // por veinte.
  const lienzo = leer('src/components/header-visual-editor/header-visual-canvas.jsx');

  assert.match(lienzo, /if \(anotados\.current === idsVisibles\) return;/);
  // Y un fallo al contar no puede romper la portada.
  assert.match(leer('src/services/store-header-analytics-service.js'), /\} catch \{/);
});

test('el resplandor neon se lee igual con la animacion apagada', () => {
  // El brillo va en la SOMBRA del texto, no en su color: quien pidio menos
  // movimiento se queda con el resplandor quieto, no con un texto invisible.
  const css = efectoACss({ efecto: 'neon', colorSecundario: '#FFAB00' });

  assert.match(css.textShadow, /#FFAB00/);
  assert.match(css.animation, /efectoNeon/);
  assert.equal(css['@media (prefers-reduced-motion: reduce)'].animation, 'none');
  // Y el color del texto no se toca, al contrario que en los de degradado.
  assert.equal(elementoACss({ efecto: 'neon', color: '#FFFFFF' }).color, '#FFFFFF');
});

test('los emojis se ponen desde el propio campo y donde esta el cursor', () => {
  // Una fila de emojis debajo del campo obliga a mirar a otro sitio para algo
  // que forma parte del texto. Y pegarlos siempre al final obliga a
  // recolocarlos: "¡Oferta 🔥 del mes!" es lo normal.
  const dialogo = leer('src/components/header-visual-editor/texto-parpadeante-dialogo.jsx');

  assert.match(dialogo, /endAdornment/);
  assert.match(dialogo, /aria-label="Agregar un emoji"/);
  assert.match(dialogo, /campo\?\.selectionStart/);
  assert.match(dialogo, /setSelectionRange\?\.\(siguiente, siguiente\)/);
});

test('la etiqueta del primer campo no la recorta el dialogo', () => {
  // Se dibuja POR ENCIMA del borde del campo; pegada al techo, el
  // desplazamiento la cortaba y se leia "exto".
  const dialogo = leer('src/components/header-visual-editor/texto-parpadeante-dialogo.jsx');

  assert.match(dialogo, /<Stack spacing=\{2\.5\} sx=\{\{ pt: 1 \}\}>/);
});

test('soltar un elemento en la franja de arriba lo elimina', () => {
  // Sacar algo del encabezado es el gesto que ya se hacia por instinto
  // —empujarlo fuera por arriba— y antes solo se conseguia soltarlo en el borde.
  const editor = leer('src/components/header-visual-editor/header-visual-editor.jsx');

  assert.match(editor, /const ALTO_DE_PAPELERA = 64;/);
  assert.match(
    editor,
    /setSobrePapelera\(event\.clientY < activo\.marco\.top \+ ALTO_DE_PAPELERA\)/
  );
  assert.match(editor, /if \(arrastre\.current && arrastrando && sobrePapelera\)/);
  // Y solo cuando se arrastra DE VERDAD: con el simple clic de seleccionar,
  // la papelera daba un parpadeo rojo cada vez que se tocaba algo.
  assert.match(editor, /const UMBRAL_DE_ARRASTRE = 4;/);
  assert.match(editor, /if \(recorrido > UMBRAL_DE_ARRASTRE\) setArrastrando\(true\);/);
  assert.match(editor, /\{arrastrando && \(/);
  // Y borrar asi es deshacible como todo lo demas, por eso no pregunta.
  assert.match(editor, /elementos: actual\.elementos\.filter\(\(item\) => item\.id !== id\)/);
});

test('la cuenta regresiva se escribe de tres maneras', () => {
  const ahora = new Date('2026-09-10T12:00:00Z').getTime();
  const restante = tiempoRestante('2026-09-11T14:30:05Z', ahora);

  assert.deepEqual(
    FORMATOS_DE_CUENTA.map((formato) => formato.id),
    ['compacto', 'reloj', 'palabras']
  );

  assert.equal(formatearCuenta(restante, 'fin', 'compacto'), '1d 02:30:05');
  // El reloj vuelca los dias en las horas: subraya la urgencia.
  assert.equal(formatearCuenta(restante, 'fin', 'reloj'), '26:30:05');
  assert.equal(formatearCuenta(restante, 'fin', 'palabras'), '1 día, 2 h, 30 min');

  // En campaña larga los segundos son ruido —y obligan a repintar cada segundo—:
  // solo salen cuando ya no queda casi nada.
  const poco = tiempoRestante('2026-09-10T12:02:30Z', ahora);
  assert.equal(formatearCuenta(poco, 'fin', 'palabras'), '2 min, 30 s');

  // Y lo elegido se guarda con el elemento.
  assert.equal(sanearElemento({ formatoCuenta: 'palabras' }).formatoCuenta, 'palabras');
  assert.equal(sanearElemento({ formatoCuenta: 'inventado' }).formatoCuenta, 'compacto');
  assert.equal(sanearElemento({ prefijoCuenta: 'Termina en' }).prefijoCuenta, 'Termina en');
});

test('los botones que despliegan lo dicen con una flecha', () => {
  const editor = leer('src/components/header-visual-editor/header-visual-editor.jsx');
  const portada = leer('src/sections/product/store-header.jsx');

  // Sin la flecha, un boton llamado "Formas" parece que agrega una forma al
  // pulsarlo, y lo que hace es abrir tres opciones.
  // "Texto parpadeante", "Formas", "Programación" y "Reversar": los cuatro que
  // abren algo, todos en la barra del editor.
  assert.equal(editor.match(/eva:arrow-ios-downward-fill/g).length, 4);
  assert.doesNotMatch(portada, /eva:arrow-ios-downward-fill/);
});

test('las formas se eligen en un flotante, con el componente que ya existia', () => {
  const editor = leer('src/components/header-visual-editor/header-visual-editor.jsx');

  assert.match(editor, />\s*Formas\s*</);
  // `CustomPopover` y `usePopover` son los del proyecto: el mismo flotante que
  // usan la tienda y las fichas, no uno nuevo.
  assert.match(editor, /import \{ CustomPopover \} from 'src\/components\/custom-popover';/);
  assert.match(editor, /const menuDeFormas = usePopover\(\);/);
  assert.match(
    editor,
    /agregarFigura\(opcion\.forma === 'linea' \? 'linea' : 'forma', opcion\.forma\)/
  );
});

test('todo lo del elemento vive en la columna, en dos pestanas', () => {
  // Repartirlo entre la columna y una tarjeta debajo obligaba a mirar a dos
  // sitios para tocar la misma pieza.
  const editor = leer('src/components/header-visual-editor/header-visual-editor.jsx');

  assert.match(editor, /<Tab value="formato" label="Formato" \/>/);

  // "Formato" es lo que se ajusta a ojo; "Ajustes", lo que se decide.
  // Y las dos comparten celda: el panel mide siempre lo que la mas larga y no
  // cambia de alto al cambiar de pestaña, que hacia saltar el encabezado.
  assert.match(editor, /gridArea: '1 \/ 1'/);
  assert.match(editor, /visibility: 'hidden'/);
  assert.doesNotMatch(editor, /pestanaActiva === panel\.clave && \(/);
  assert.match(
    editor,
    /\{renderEfecto\(elemento, \{ conColores: elemento\.tipo !== 'imagen' \}\)\}/
  );
  assert.match(editor, /\{renderComunes\(elemento\)\}/);
  // Las dos estan SIEMPRE: apareciendo y desapareciendo, el panel daba un salto
  // cada vez que se pulsaba o se soltaba una pieza.
  assert.match(editor, /<Tab value="ajustes" label="Ajustes" disabled=\{!elemento\} \/>/);
  assert.match(editor, /const pestanaActiva = elemento \? pestana : 'formato';/);
});

test('las figuras y el escudo se ven tambien mientras se edita', () => {
  // Sus medidas son porcentajes del LIENZO; dentro de la envoltura del editor
  // se resolvian contra una caja de altura cero y desaparecian, asi que solo
  // asomaban al previsualizar.
  const editor = leer('src/components/header-visual-editor/header-visual-editor.jsx');

  assert.match(editor, /const esFigura = item\.tipo === 'linea' \|\| item\.tipo === 'forma';/);
  assert.match(
    editor,
    /height: item\.tipo === 'linea' \? `\$\{item\.grosor\}px` : `\$\{item\.alto\}%`/
  );
  assert.match(editor, /width: '100% !important'/);
});

test('el ojo dice para que sirve', () => {
  // Al lado de tres pantallas, un ojo suelto parece otro tamaño mas.
  const editor = leer('src/components/header-visual-editor/header-visual-editor.jsx');

  assert.match(editor, /Vista previa: así lo verá el cliente/);
  assert.match(editor, /aria-label="Vista previa"/);
});

test('la capa, el candado y el enlace se manejan desde la barra', () => {
  // No son formato —no se ajustan mirando como queda—: son decisiones de un
  // vistazo, y en la columna obligaban a bajar a buscarlas cada vez.
  const editor = leer('src/components/header-visual-editor/header-visual-editor.jsx');
  const fila = editor.slice(
    editor.indexOf('const renderFilaDePieza'),
    editor.indexOf('const renderPaleta')
  );

  assert.match(fila, /title="Traer al frente"/);
  assert.match(fila, /title="Enviar atrás"/);
  assert.match(fila, /label="Enlace"/);
  assert.match(fila, /title="Mostrar como botón"/);

  // La fila esta siempre y se apaga sin seleccion: apareciendo y
  // desapareciendo, empujaba el encabezado hacia abajo en cada clic.
  assert.match(fila, /disabled=\{!elemento\}/);
  assert.match(fila, /Sin selección/);
  assert.match(editor, /\{!previsualizando && renderFilaDePieza\(\)\}/);

  // Y ya no estan duplicados en la columna.
  const comunes = editor.slice(
    editor.indexOf('const renderComunes'),
    editor.indexOf('const renderFilaDePieza')
  );
  assert.doesNotMatch(comunes, /Al frente|Bloquear|label="Enlace"|label="Desde"/);
});

test('la programacion se abre desde la barra, en un flotante', () => {
  // Dos campos de fecha y hora en linea se comen la barra entera, y ademas no
  // se tocan en cada cambio: solo al montar la promocion.
  const editor = leer('src/components/header-visual-editor/header-visual-editor.jsx');
  const fila = editor.slice(
    editor.indexOf('const renderFilaDePieza'),
    editor.indexOf('const renderPaleta')
  );

  assert.match(fila, />\s*Programación\s*</);
  assert.match(fila, /onClick=\{menuDeProgramacion\.onOpen\}/);
  // El boton se enciende cuando hay fechas, para que no se olvide que las tiene.
  assert.match(fila, /elemento\?\.desde \|\| elemento\?\.hasta \? 'primary' : 'inherit'/);
  // Y despliega, asi que lo dice con la flecha.
  assert.match(fila, /eva:arrow-ios-downward-fill/);

  assert.match(editor, /open=\{menuDeProgramacion\.open\}/);
  // Y con el calendario del proyecto, el mismo de la fecha de nacimiento: el
  // nativo cambia de aspecto y de orden de campos en cada sistema.
  assert.match(editor, /<DateTimePicker/);
  assert.match(editor, /format="DD\/MM\/YYYY hh:mm A"/);
  assert.doesNotMatch(editor, /type="datetime-local"/);
  assert.match(editor, /label="Desde"/);
  assert.match(editor, /Quitar las fechas/);
});

test('la foto se encuadra con la forma MEDIDA del encabezado', () => {
  // Una franja fija primero, y despues el ancho de referencia con el alto
  // guardado: las dos se equivocaban por lo mismo. La portada ocupa el ancho de
  // VERDAD del navegador —1450 px en un monitor, 380 en un telefono— y su alto
  // depende de lo que lleve dentro, asi que el recorte salia mas alto o mas bajo
  // de lo que se veia.
  const foto = leer('src/sections/product/store-header-photo.jsx');
  const portada = leer('src/sections/product/store-header.jsx');

  assert.match(foto, /const proporcionDe = \(altura, medida\) =>/);
  assert.match(foto, /medida > 0 \? medida : ANCHO_DE_REFERENCIA/);
  assert.match(foto, /medidaPortada\.ancho \/ medidaPortada\.alto/);
  assert.match(foto, /aspect=\{proporcion\}/);
  assert.doesNotMatch(foto, /16 \/ 5/);

  // La mide el propio encabezado, en las dos formas que puede tener.
  assert.match(portada, /new ResizeObserver/);
  assert.match(portada, /setMedidaPortada\(\{ ancho: width, alto: height \}\)/);
  assert.equal(portada.match(/ref=\{portadaRef\}/g).length, 2);
  assert.match(portada, /medidaPortada=\{medidaPortada\}/);
});

test('una foto nueva no se queda debajo del fondo del diseño', () => {
  // Con el diseño libre encendido, su fondo se pinta ENCIMA de la foto: si
  // quedo opaco, la foto se subia, se guardaba y no se veia por ninguna parte.
  const portada = leer('src/sections/product/store-header.jsx');

  assert.match(
    portada,
    /const tapaLaFoto = !!url && diseno\?\.activo && \(diseno\?\.fondo\?\.opacidad \?\? 1\) >= 1;/
  );
  assert.match(portada, /fondo: \{ \.\.\.diseno\.fondo, opacidad: 0\.62 \}/);
  // Quien quiera taparla del todo tiene el control de opacidad en el editor.
  assert.match(
    leer('src/components/header-visual-editor/header-visual-editor.jsx'),
    /deja ver la fotografía/
  );
});

test('se puede cambiar la foto tantas veces como haga falta', () => {
  // Vaciar la entrada AL RECIBIR el archivo dependia de que ese `onChange`
  // llegara a ejecutarse; si el segundo intento se quedaba con el nombre del
  // primero dentro, el navegador decidia que "no habia cambiado nada" y no
  // avisaba: el boton parecia muerto.
  const foto = leer('src/sections/product/store-header-photo.jsx');

  // El boton ES la etiqueta del campo: pedirle al navegador que pulse un
  // `input` escondido funciona a veces y a veces no.
  assert.match(foto, /component="label"/);
  assert.doesNotMatch(foto, /entradaRef\.current\?\.click\(\)/);
  // Y la `key` cambia con la foto que ya hay, asi que volver a elegir el MISMO
  // archivo tambien cuenta como cambio.
  assert.match(foto, /key=\{vistaPrevia \|\| 'sin-foto'\}/);

  // Lo mismo en el editor, que tenia el mismo clic programatico.
  const editor = leer('src/components/header-visual-editor/header-visual-editor.jsx');
  assert.doesNotMatch(editor, /entradaImagenRef/);
  assert.match(editor, /key=\{elemento\.url \|\| 'sin-imagen'\}/);
  // Y un recortador nuevo por foto: reutilizarlo dejaba el encuadre anterior.
  assert.match(foto, /key=\{origen\}/);
});

test('guardar el encuadre nunca es un callejon sin salida', () => {
  // Un boton que no responde y no explica por que es peor que un encuadre por
  // defecto: sin area elegida se usa la foto entera.
  const foto = leer('src/sections/product/store-header-photo.jsx');

  assert.match(foto, /const zona = area \?\? \(await areaCompleta\(origen, alto\)\)/);
  assert.doesNotMatch(foto, /onClick=\{handleGuardarEncuadre\} disabled=\{!area\}/);
  // Y lo que no es una imagen se dice, en vez de no pasar nada.
  assert.match(foto, /Ese archivo no es una imagen\./);
});

test('la paleta: los de la casa, la rueda completa y la X, en ese orden', () => {
  // Lo frecuente primero y lo excepcional despues: con la rueda delante, cada
  // cambio de color pedia abrir un flotante para elegir a mano un tono que ya
  // estaba a un clic en la fila.
  const paleta = leer('src/components/header-visual-editor/paleta-de-colores.jsx');

  const orden = ['PALETA.map', 'Elegir otro color', 'Sin color'].map((marca) =>
    paleta.indexOf(marca)
  );

  assert.ok(
    orden.every((posicion) => posicion > 0),
    'las tres opciones existen'
  );
  assert.deepEqual(
    [...orden].sort((uno, otro) => uno - otro),
    orden,
    'y en ese orden'
  );
});

test('se puede poner cualquier color, con la rueda o escribiendo el codigo', () => {
  const paleta = leer('src/components/header-visual-editor/paleta-de-colores.jsx');

  assert.match(paleta, /type="color"/);
  assert.match(paleta, /label="Código"/);
  // El codigo se aplica solo cuando es un color de verdad: si no, el texto
  // parpadeaba de color mientras se escribia "#1A2B3C" letra a letra.
  assert.match(paleta, /test\(limpio\)\) propagar\(limpio\)/);
});

test('sin color se queda sin color, tambien bajo el velo del fondo', () => {
  // La opacidad de la capa lo convertia en un negro a medias: bajar el velo
  // hacia aparecer un gris donde se habia pedido que no hubiera nada.
  const { SIN_COLOR, esSinColor, fondoACss } = modelo;

  assert.equal(esSinColor(SIN_COLOR), true);
  assert.equal(sanearColor(SIN_COLOR), SIN_COLOR);
  assert.match(
    fondoACss({ tipo: 'degradado', colorSecundario: SIN_COLOR, opacidad: 0.5 }),
    /#00000000 100%/
  );
});

test('la rueda de color no arrastra al encabezado en cada pixel', () => {
  // Llevar cada micro-cambio hasta el diseño repintaba el encabezado entero y
  // apilaba una entrada de historial por pixel: la bolita iba a tirones y
  // despues hacian falta cien "deshacer" para volver atras.
  const paleta = leer('src/components/header-visual-editor/paleta-de-colores.jsx');
  const editor = leer('src/components/header-visual-editor/header-visual-editor.jsx');

  // Lo que se ve va al instante; lo que se guarda, una vez por fotograma.
  assert.match(paleta, /requestAnimationFrame\(\(\) => \{/);
  assert.match(paleta, /onElegir\(pendiente\.current, 'color-continuo'\)/);
  assert.match(paleta, /cancelAnimationFrame/);

  // Y con etiqueta, para que el historial funda todo el gesto en una entrada.
  assert.match(editor, /if \(!etiqueta\) cerrarGesto\(\);/);
  assert.match(editor, /cambiarElemento\(elemento\.id, \{ color \}, etiqueta\)/);
  assert.match(editor, /cambiarFondo\(\{ color \}, etiqueta\)/);
});

test('el recuadro de la foto enseña la portada entera, no la foto sola', () => {
  // Lo que hay que decidir al encuadrar es si el titulo se va a leer sobre la
  // foto y si la cara importante queda tapada.
  const foto = leer('src/sections/product/store-header-photo.jsx');
  const portada = leer('src/sections/product/store-header.jsx');

  assert.match(foto, /\{!enEncuadre && !!superposicion && escala > 0 && \(/);
  assert.match(portada, /superposicion=\{renderPortadaEnMiniatura\(\)\}/);
  // Con las MISMAS piezas que la portada: el lienzo con diseño libre, y el
  // escudo con sus textos cuando no lo hay.
  assert.match(portada, /const renderPortadaEnMiniatura = \(\) => \{/);
  assert.match(portada, /<HeaderVisualCanvas\s*\n\s*diseno=\{borrador\.disenoAvanzado\}/);
  assert.match(portada, /<Logo disabled sx=\{\{ width: 48, height: 48 \}\} \/>/);
});

test('nada se lee antes de declararse: la portada se pinta', () => {
  // Un efecto colocado POR ENCIMA de la variable que lee en su lista de
  // dependencias no es un aviso en consola: revienta el componente al pintarlo
  // y la pantalla se queda sin portada, sin explicar por que. Paso con
  // `disenoActivo` y el medidor de la proporcion.
  const portada = leer('src/sections/product/store-header.jsx');

  const declaraciones = [...portada.matchAll(/^ {2}const (\w+) = /gm)].reduce(
    (mapa, coincidencia) => ({ ...mapa, [coincidencia[1]]: coincidencia.index }),
    {}
  );

  [...portada.matchAll(/\}, \[([^\]]*)\]\);/g)].forEach((uso) => {
    uso[1]
      .split(',')
      .map((nombre) => nombre.trim().split('.')[0])
      .filter((nombre) => nombre in declaraciones)
      .forEach((nombre) => {
        assert.ok(
          declaraciones[nombre] < uso.index,
          `"${nombre}" se usa en una lista de dependencias antes de declararse`
        );
      });
  });
});

test('el lapiz abre el editor, y el flotante se queda solo con la foto', () => {
  // Antes el lapiz abria un formulario de textos y de ahi habia que pulsar
  // "Avanzados": dos pasos para lo mismo, y el formulario tapaba justo la
  // portada que se iba a tocar. Los textos no se pierden: se escriben sobre el
  // encabezado, que es donde se ven mientras se escriben.
  const portada = leer('src/sections/product/store-header.jsx');
  const editor = leer('src/components/header-visual-editor/header-visual-editor.jsx');

  assert.match(portada, /setEditandoDiseno\(true\);/);
  assert.doesNotMatch(portada, /label="Título"/);
  assert.doesNotMatch(portada, /label="Disposición"/);
  assert.doesNotMatch(portada, /label="Subtítulo"/);
  assert.match(portada, /<DialogTitle>Fotografía de la portada<\/DialogTitle>/);

  // Y la foto se abre desde la barra del editor.
  assert.match(editor, />\s*Fotografía\s*</);
  assert.match(portada, /onAbrirFoto=\{handleAbrirFoto\}/);
});

test('el lapiz se ve sobre cualquier foto', () => {
  // Un icono blanco a secas desaparece en cuanto la portada lleva cielo, nieve
  // o una pared clara detras.
  const portada = leer('src/sections/product/store-header.jsx');

  assert.match(portada, /const estiloDelLapiz = \(theme\) => \(\{/);
  assert.match(portada, /backdropFilter: 'blur\(6px\)'/);
  assert.match(portada, /boxShadow: `0 2px 8px/);
  // En las dos formas del encabezado, no solo en una.
  assert.equal(portada.match(/estiloDelLapiz\]/g).length, 2);
});

test('en el flotante se ve el MISMO encuadre que en la portada', () => {
  // Los mismos angulos: el encabezado entero, a menor escala. Medir igual de
  // ancho es imposible sin ensanchar el dialogo; con el alto en pixeles y el
  // ancho recortado se veia un pedazo ampliado, y ahi no se juzga el encuadre.
  const foto = leer('src/sections/product/store-header-photo.jsx');
  const portada = leer('src/sections/product/store-header.jsx');

  assert.match(portada, /<Dialog fullWidth maxWidth="md"/);
  // La FORMA de la portada, medida.
  // El recuadro se estira hacia abajo un poco —para colocar con holgura— pero
  // el ancho no se toca, que es lo que fija los angulos.
  // El numero es de ajuste fino —se sube o se baja a ojo—; lo que no puede
  // faltar es la constante y que solo toque el alto.
  assert.match(foto, /const ESTIRADO_VERTICAL = [\d.]+;/);
  assert.match(
    foto,
    /aspectRatio: `\$\{ANCHO\} \/ \$\{Math\.round\(alto \* ESTIRADO_VERTICAL\)\}`/
  );
  assert.match(foto, /medidaPortada\.ancho \/ medidaPortada\.alto/);
  assert.match(foto, /aspect=\{proporcion\}/);
  // Y la maqueta se encoge entera, no se redibuja pequeña.
  assert.match(foto, /anchoDelMarco \/ medidaPortada\.ancho/);
  assert.match(foto, /transform: `scale\(\$\{escala\}\)`/);
  assert.match(foto, /transformOrigin: 'top left'/);
});

test('en la miniatura el lema va donde lo pone la disposicion', () => {
  // En la clasica va DEBAJO del titulo. Puesto a la derecha —que es donde va en
  // la franja— quedaba fuera del borde y en el dialogo no se veia por ninguna
  // parte.
  const portada = leer('src/sections/product/store-header.jsx');
  const miniatura = portada.slice(
    portada.indexOf('const renderPortadaEnMiniatura'),
    portada.indexOf('const handleGuardar = useCallback')
  );

  // Dos sitios para el lema, uno por disposicion.
  assert.equal(miniatura.match(/\{borrador\.subtitulo\}/g).length, 2);
  assert.match(miniatura, /\{franjaEnBorrador \? \(/);
  // Y la maqueta usa los mismos tamaños que la portada, porque se pinta a
  // tamaño real y se encoge entera.
  assert.match(miniatura, /variant="h4"/);
  assert.match(miniatura, /px: \{ xs: 2\.5, md: 4 \}/);
});
