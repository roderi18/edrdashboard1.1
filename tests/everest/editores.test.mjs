// ----------------------------------------------------------------------
// LOS EDITORES DE EXPLORA DESIGNER (fase 4).
//
// Lo que se podia romper al empezar a editar, y se comprueba aqui:
//
//   - Tocar el contenido de partida EN SU SITIO. Ese contenido puede ser el valor
//     de fabrica: el mismo objeto que pinta la portada. Cambiarlo sin copiar
//     cambiaria la portada de quien edita sin haber publicado nada.
//   - Que un fondo subido desde el Designer pisara la foto o el video que la
//     portada esta usando ahora.
//   - Que las tarjetas dejaran de pintarse igual cuando NO traen los campos
//     nuevos (fechas, fondo, boton): el valor de fabrica no los trae.
//   - Que un bloque sin decision tomada ("Mi progreso") se pudiera editar igual.
// ----------------------------------------------------------------------

import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { register } from 'node:module';
import assert from 'node:assert/strict';

register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

const { FABRICA_DE_PORTADA } = await import('src/sections/principal/fabrica-de-portada.js');
const { bloquesPublicablesDe } = await import('src/utils/everest/bloques.mjs');
const { conCampo, cambiadorDe } = await import('src/sections/everest/editores/cambios.js');
const { fechaCorta, fechaCortaAISO } = await import('src/utils/everest/presentacion.mjs');

const leer = (relativa) => fs.readFileSync(path.join(process.cwd(), relativa), 'utf8');

// El codigo sin sus comentarios: los comentarios EXPLICAN lo que no se hace
// ("no se toca principal-tarjetas") y harian fallar una busqueda sobre el codigo.
const soloCodigo = (codigo) =>
  codigo.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^\s*\/\/.*$/gm, '');

// ----------------------------------------------------------------------
// CAMBIAR SIN TOCAR EL ORIGINAL
// ----------------------------------------------------------------------

test('cambiar un campo devuelve una copia y deja el original intacto', () => {
  const fabrica = FABRICA_DE_PORTADA['proxima-actividad'];
  const antes = JSON.stringify(fabrica);
  const cambiada = conCampo(fabrica, 'titulo', 'Investidura Nacional');

  assert.notEqual(cambiada, fabrica);
  assert.equal(cambiada.titulo, 'Investidura Nacional');
  assert.equal(JSON.stringify(fabrica), antes);
});

test('poner un campo en undefined lo quita: vuelve a su valor de siempre', () => {
  const conFondo = { titulo: 'x', fondo: { url: 'https://a.test/x.webp', tipo: 'imagen' } };
  const sinFondo = conCampo(conFondo, 'fondo', undefined);

  assert.ok(!('fondo' in sinFondo));
  assert.ok('fondo' in conFondo);
});

test('el cambiador llama con la copia', () => {
  const recibidos = [];
  const cambiar = cambiadorDe({ lema: 'a' }, (contenido) => recibidos.push(contenido));

  cambiar('lema', 'b');

  assert.deepEqual(recibidos, [{ lema: 'b' }]);
});

// ----------------------------------------------------------------------
// QUE BLOQUES SE EDITAN
// ----------------------------------------------------------------------

test('todos los bloques de la portada tienen editor de contenido', () => {
  const registro = leer('src/sections/everest/editores/index.js');
  const conEditor = [...registro.matchAll(/^\s+'?([a-z-]+)'?: Editor/gm)].map(([, id]) => id);
  const publicables = bloquesPublicablesDe('principal').map((bloque) => bloque.id);

  assert.deepEqual([...conEditor].sort(), [...publicables].sort());
});

test('las cifras, el nivel y "Mi progreso" avisan de que son los mismos para todos', () => {
  const editor = soloCodigo(leer('src/sections/everest/editores/editores-simples.jsx'));
  const bienvenida = editor.slice(
    editor.indexOf('export function EditorBienvenida'),
    editor.indexOf('export function EditorMiProgreso')
  );
  const progreso = editor.slice(
    editor.indexOf('export function EditorMiProgreso'),
    editor.indexOf('export function EditorLema')
  );

  // Se editan, pero con el aviso a la vista: parecen de cada persona y no lo son.
  assert.match(bienvenida, /<AvisoDeDatosIguales \/>/);
  assert.match(bienvenida, /cambiar\('cifras', cifras\)/);
  assert.match(bienvenida, /cambiar\('nivel',/);
  assert.match(progreso, /<AvisoDeDatosIguales \/>/);
  assert.match(editor, /Estos números son los mismos para todos/);
});

test('el Designer monta el editor del bloque abierto y lo reinicia al cambiar de bloque', () => {
  const vista = leer('src/sections/everest/view/everest-designer-view.jsx');

  assert.match(vista, /const Editor = EDITORES_DE_BLOQUE\[idSeleccionado\];/);
  assert.match(
    vista,
    /estadoSeleccionado\?\.borrador\?\.contenido \?\? estadoSeleccionado\?\.enVivo\?\.contenido/
  );
  assert.match(vista, /key=\{idSeleccionado\}/);
  assert.match(vista, /designer\.cambiarContenido\(idSeleccionado, contenido\)/);
  assert.match(vista, /editor=\{editor\}/);
});

// ----------------------------------------------------------------------
// LOS FONDOS NUEVOS NO PISAN LOS DE HOY
// ----------------------------------------------------------------------

test('los fondos se suben a everest/, con marca de tiempo, y la regla reconoce el video', () => {
  const servicio = soloCodigo(leer('src/services/everest-medios-service.js'));

  assert.match(
    servicio,
    /`\$\{CARPETA_MEDIOS_EXPLORA\}\/\$\{idBloque\}\/\$\{marca\}-video\.\$\{extension\}`/
  );
  assert.match(servicio, /`\$\{CARPETA_MEDIOS_EXPLORA\}\/\$\{idBloque\}\/\$\{marca\}\.webp`/);
  assert.doesNotMatch(servicio, /principal-tarjetas|principalTarjeta/);
  assert.match(servicio, /if \(!isAdminGlobal\(usuario\)\)/);

  // El nombre que genera el servicio para un video pasa la regla de Storage.
  const regla = /^.*-video\.(mp4|webm)$/;

  assert.ok(regla.test('1758000000000-video.mp4'));
  assert.ok(!regla.test('1758000000000.webp'));
  assert.match(leer('storage.rules'), /match \/everest\/\{idBloque\}\/\{archivo\}/);
});

// ----------------------------------------------------------------------
// LAS TARJETAS SIN LOS CAMPOS NUEVOS SE PINTAN COMO SIEMPRE
// ----------------------------------------------------------------------

test('la proxima actividad usa sus fechas, fondo y boton solo si los trae', () => {
  const tarjeta = leer('src/sections/principal/principal-actividad.jsx');

  assert.match(tarjeta, /const actividad = actividadParaPintar\(recibida\);/);
  assert.match(tarjeta, /const foto = actividad\.fondo \? actividad\.fondo\.url : tarjeta\.foto;/);
  // Sin boton propio, el de siempre: mismo texto y mismo destino.
  assert.match(tarjeta, /href=\{actividad\.boton\?\.destino \?\? paths\.dashboard\.calendar\}/);
  assert.match(tarjeta, /\{actividad\.boton\?\.texto \?\? '¡Inscrbirme ahora!'\}/);
});

test('la bienvenida usa su fondo solo si lo trae, y los eventos solo se filtran con fecha', () => {
  assert.match(
    leer('src/sections/principal/principal-bienvenida.jsx'),
    /const fondo = resumen\.fondo \? resumen\.fondo\.url : banner\.foto;/
  );
  assert.match(
    leer('src/sections/principal/principal-lateral.jsx'),
    /\{eventosVigentes\(eventos\)\.map\(\(evento\) => \(/
  );
});

// ----------------------------------------------------------------------
// LAS FECHAS DE LOS COMUNICADOS
// ----------------------------------------------------------------------

test('la fecha escrita de un comunicado se abre en el calendario, y vuelve igual', () => {
  FABRICA_DE_PORTADA.comunicados.forEach((comunicado) => {
    const iso = fechaCortaAISO(comunicado.fecha);

    assert.ok(iso, comunicado.fecha);
    assert.equal(fechaCorta(iso), comunicado.fecha);
  });
  assert.equal(fechaCortaAISO('mañana'), null);
  assert.equal(fechaCortaAISO('31 feb 2026'), null);
});
