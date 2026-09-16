// ----------------------------------------------------------------------
// LA PANTALLA DE EVEREST DESIGNER (fase 3).
//
// Lo que se rompia o se podia romper, y se comprueba aqui:
//
//   - La lista decia "Original" de un bloque con cambios a medias, o enseñaba un
//     borrador roto en la vista previa como si se pudiera publicar.
//   - Un enlace al Designer con `volver=https://otro-sitio` sacaria de la
//     aplicacion a quien pulsara "Volver".
//   - La vista previa va en un iframe y habla por mensajes: sin comprobar quien
//     los manda, cualquier pagina podria meterle contenido.
//   - La pestaña es solo del Administrador Global, aunque a Administracion entren
//     tambien la Oficina Nacional y el Administrador Funcional.
// ----------------------------------------------------------------------

import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { register } from 'node:module';
import assert from 'node:assert/strict';

register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

const { FABRICA_DE_PORTADA } = await import('src/sections/principal/fabrica-de-portada.js');
const { BLOQUES_EVEREST } = await import('src/utils/everest/bloques.mjs');
const { estadoDelBloque, estadosDeLosBloques, destinoDeVuelta, ESTADOS_DEL_BLOQUE } =
  await import('src/utils/everest/estado-del-bloque.mjs');
const {
  mensajeAlto,
  mensajeLista,
  mensajeValido,
  mensajeContenido,
  FUENTE_DESIGNER,
  FUENTE_VISTA_PREVIA,
} = await import('src/utils/everest/mensajes-vista-previa.mjs');

const leer = (relativa) => fs.readFileSync(path.join(process.cwd(), relativa), 'utf8');

const ACTIVIDAD_NUEVA = {
  titulo: 'Investidura Nacional 2026',
  lugar: 'Santiago de los Caballeros',
  fechas: '14 noviembre 2026',
  diasQueFaltan: 59,
  estado: 'Inscripciones abiertas',
};

const estadoDe = (idBloque, { publicado = null, borradores = null } = {}) =>
  estadoDelBloque({ idBloque, publicado, borradores, fabrica: FABRICA_DE_PORTADA });

// ----------------------------------------------------------------------
// EL ESTADO DE CADA BLOQUE
// ----------------------------------------------------------------------

test('sin nada publicado ni borradores, cada bloque esta en su original', () => {
  const estado = estadoDe('proxima-actividad');

  assert.equal(estado.estado, ESTADOS_DEL_BLOQUE.original);
  assert.equal(estado.borrador, null);
  // La vista previa enseña lo mismo que la portada: el MISMO objeto de fabrica.
  assert.equal(estado.contenidoDeLaVistaPrevia, FABRICA_DE_PORTADA['proxima-actividad']);
});

test('un bloque publicado se marca como publicado y enseña lo publicado', () => {
  const estado = estadoDe('proxima-actividad', {
    publicado: { bloques: { 'proxima-actividad': { contenido: ACTIVIDAD_NUEVA } } },
  });

  assert.equal(estado.estado, ESTADOS_DEL_BLOQUE.publicado);
  assert.deepEqual(estado.contenidoDeLaVistaPrevia, ACTIVIDAD_NUEVA);
});

test('con un borrador valido, la vista previa enseña el borrador', () => {
  const estado = estadoDe('proxima-actividad', {
    borradores: {
      bloques: {
        'proxima-actividad': { contenido: ACTIVIDAD_NUEVA, guardadoEn: '2026-09-16T12:00:00.000Z' },
      },
    },
  });

  assert.equal(estado.estado, ESTADOS_DEL_BLOQUE.borrador);
  assert.equal(estado.borrador.valido, true);
  assert.equal(estado.borrador.guardadoEn, '2026-09-16T12:00:00.000Z');
  assert.deepEqual(estado.contenidoDeLaVistaPrevia, ACTIVIDAD_NUEVA);
});

test('un borrador a medias se marca como borrador, pero no se enseña como si valiera', () => {
  const estado = estadoDe('proxima-actividad', {
    borradores: { bloques: { 'proxima-actividad': { contenido: { titulo: '' } } } },
  });

  assert.equal(estado.estado, ESTADOS_DEL_BLOQUE.borrador);
  assert.equal(estado.borrador.valido, false);
  // Lo que esta en vivo, no el borrador roto.
  assert.equal(estado.contenidoDeLaVistaPrevia, FABRICA_DE_PORTADA['proxima-actividad']);
});

test('un borrador manda sobre lo publicado en la lista: hay algo pendiente', () => {
  const estado = estadoDe('proxima-actividad', {
    publicado: { bloques: { 'proxima-actividad': { contenido: ACTIVIDAD_NUEVA } } },
    borradores: {
      bloques: { 'proxima-actividad': { contenido: { ...ACTIVIDAD_NUEVA, estado: 'Cerrado' } } },
    },
  });

  assert.equal(estado.estado, ESTADOS_DEL_BLOQUE.borrador);
  assert.equal(estado.enVivo.origen, 'designer');
  assert.equal(estado.contenidoDeLaVistaPrevia.estado, 'Cerrado');
});

test('el encabezado de la tienda tiene su propio editor', () => {
  const estado = estadoDe('encabezado-tienda');

  assert.equal(estado.estado, ESTADOS_DEL_BLOQUE.externo);
  assert.equal(estado.contenidoDeLaVistaPrevia, null);
});

test('la lista trae todos los bloques, en el orden del registro, aunque lleguen datos raros', () => {
  const estados = estadosDeLosBloques({
    publicado: 'basura',
    borradores: { bloques: [] },
    fabrica: FABRICA_DE_PORTADA,
  });

  assert.deepEqual(
    estados.map((estado) => estado.idBloque),
    BLOQUES_EVEREST.map((bloque) => bloque.id)
  );
  estados
    .filter((estado) => estado.estado !== ESTADOS_DEL_BLOQUE.externo)
    .forEach((estado) => assert.equal(estado.estado, ESTADOS_DEL_BLOQUE.original, estado.idBloque));
});

// ----------------------------------------------------------------------
// VOLVER DESDE UN LAPIZ
// ----------------------------------------------------------------------

test('"Volver" solo lleva a una ruta de la propia aplicacion', () => {
  assert.equal(destinoDeVuelta('/dashboard/principal'), '/dashboard/principal');
  assert.equal(destinoDeVuelta('https://otro-sitio.com'), '');
  assert.equal(destinoDeVuelta('//otro-sitio.com'), '');
  assert.equal(destinoDeVuelta('/\\otro-sitio.com'), '');
  assert.equal(destinoDeVuelta('/con espacio'), '');
  assert.equal(destinoDeVuelta(null), '');
});

// ----------------------------------------------------------------------
// LOS MENSAJES CON LA VISTA PREVIA
// ----------------------------------------------------------------------

const ORIGEN = 'http://localhost:3032';
const evento = (data, origin = ORIGEN) => ({ data, origin });

test('un mensaje de la misma aplicacion y de quien se espera, se acepta', () => {
  assert.deepEqual(
    mensajeValido(evento(mensajeLista()), ORIGEN, FUENTE_VISTA_PREVIA),
    mensajeLista()
  );
  assert.deepEqual(
    mensajeValido(evento(mensajeContenido('lema', { titulo: 'x' })), ORIGEN, FUENTE_DESIGNER),
    mensajeContenido('lema', { titulo: 'x' })
  );
});

test('de otro sitio, de otra fuente o de un tipo desconocido, no', () => {
  assert.equal(
    mensajeValido(evento(mensajeLista(), 'https://otro-sitio.com'), ORIGEN, FUENTE_VISTA_PREVIA),
    null
  );
  // La vista previa no acepta mensajes que dicen venir de la vista previa.
  assert.equal(mensajeValido(evento(mensajeLista()), ORIGEN, FUENTE_DESIGNER), null);
  assert.equal(
    mensajeValido(
      evento({ fuente: FUENTE_DESIGNER, tipo: 'borrar-todo' }),
      ORIGEN,
      FUENTE_DESIGNER
    ),
    null
  );
  assert.equal(mensajeValido(evento('texto suelto'), ORIGEN, FUENTE_DESIGNER), null);
  assert.equal(mensajeValido(null, ORIGEN, FUENTE_DESIGNER), null);
});

test('el alto que manda la vista previa es siempre un numero entero y positivo', () => {
  assert.equal(mensajeAlto(412.3).alto, 413);
  assert.equal(mensajeAlto(-5).alto, 0);
  assert.equal(mensajeAlto('no').alto, 0);
});

// ----------------------------------------------------------------------
// EL CABLEADO
// ----------------------------------------------------------------------

// ES UNA ENTRADA DEL MENU, NO UNA PESTAÑA. Nacio como pestaña de Administracion
// y se pidio sacarla: va en el menu lateral, justo debajo de "Administradores".
// Colgando de /dashboard/admin heredaba sus pestañas y su encabezado.
test('va en el menu lateral, justo debajo de Administradores, y fuera de /dashboard/admin', () => {
  const menu = leer('src/layouts/nav-config-dashboard.jsx');

  assert.match(menu, /title: 'EVEREST Designer',\s*path: paths\.dashboard\.everest,/);
  // Se inserta DETRAS de la entrada de Administradores, dentro de su seccion.
  assert.match(menu, /seccion\.subheader === 'Administración'/);
  assert.match(
    menu,
    /item\.path === paths\.dashboard\.admin\.root \? \[item, entradaEverestDesigner\] : \[item\]/
  );

  const paths = leer('src/routes/paths.js');

  assert.match(paths, /everest: `\$\{ROOTS\.DASHBOARD\}\/everest`,/);
  assert.doesNotMatch(paths, /\/admin\/everest/);
  assert.ok(fs.existsSync(path.join(process.cwd(), 'src/app/dashboard/everest/page.jsx')));
  assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/app/dashboard/admin/everest')));

  // Y las pestañas de Administracion quedan como estaban.
  assert.doesNotMatch(leer('src/sections/admin/layout/admin-tabs-layout.jsx'), /EVEREST/);
});

test('el menu solo se la enseña al Administrador Global, el mismo que puede abrirla', () => {
  const layout = leer('src/layouts/dashboard/layout.jsx');

  // Despues del filtro del menu, como la tienda de administracion.
  assert.match(
    layout,
    /return isAdminGlobal\(user\) \? conEverestDesigner\(conTienda\) : conTienda;/
  );
  assert.match(layout, /filterDashboardNavDataByUser\([\s\S]*?conEverestDesigner\(/);
});

test('escribir la direccion a mano tampoco abre el Designer a otro cargo', () => {
  assert.match(
    leer('src/sections/everest/view/everest-designer-view.jsx'),
    /if \(!isAdminGlobal\(user\)\) \{/
  );
  assert.match(
    leer('src/sections/everest/view/everest-vista-previa-view.jsx'),
    /if \(!puedeVer\) return null;/
  );
});

test('la vista previa vive fuera del panel, con sesion, y solo escucha a su Designer', () => {
  const pagina = leer('src/app/vista-previa/everest/page.jsx');
  const dentro = leer('src/sections/everest/view/everest-vista-previa-view.jsx');
  const fuera = leer('src/sections/everest/everest-vista-previa.jsx');

  assert.match(pagina, /<AuthGuard>/);
  assert.match(leer('src/routes/paths.js'), /everestVistaPrevia: '\/vista-previa\/everest'/);

  assert.match(dentro, /if \(evento\.source !== window\.parent\) return;/);
  assert.match(dentro, /mensajeValido\(evento, window\.location\.origin, FUENTE_DESIGNER\)/);
  assert.match(fuera, /if \(evento\.source !== marcoRef\.current\?\.contentWindow\) return;/);
  assert.match(fuera, /mensajeValido\(evento, window\.location\.origin, FUENTE_VISTA_PREVIA\)/);
  // Nunca al comodin '*': solo a la propia aplicacion.
  assert.doesNotMatch(dentro + fuera, /postMessage\([^)]*'\*'\)/);
});

test('la vista previa pinta con los componentes reales de la portada, sin lapices', () => {
  const bloque = leer('src/sections/everest/bloque-de-la-portada.jsx');

  // Cada bloque se pinta con el componente de /principal, no con una imitacion.
  const importados = [...bloque.matchAll(/import \{([^}]*)\} from 'src\/sections\/principal\//g)]
    .flatMap(([, nombres]) => nombres.split(','))
    .map((nombre) => nombre.trim())
    .filter(Boolean);

  [
    'PrincipalBienvenida',
    'PrincipalAccesos',
    'PrincipalProximaActividad',
    'PrincipalMiProgreso',
    'PrincipalHistorias',
    'PrincipalEventos',
    'PrincipalDestacado',
    'PrincipalComunicados',
    'PrincipalLema',
  ].forEach((componente) => {
    assert.ok(importados.includes(componente), `${componente} no viene de /principal`);
    assert.match(bloque, new RegExp(`<${componente}\\b`), componente);
  });
  assert.doesNotMatch(bloque, /puedeEditar/);
  assert.match(bloque, /identidadDeLaSesion\(user\)/);
});

test('publicar exige un borrador valido, y el borrador se tira despues', () => {
  const designer = leer('src/sections/everest/hooks/use-everest-designer.js');
  const panel = leer('src/sections/everest/everest-panel-del-bloque.jsx');

  assert.match(designer, /if \(!estado\?\.borrador\?\.valido\) \{/);
  assert.match(designer, /await publicarBloque\([\s\S]*?await descartarBorradorDeBloque\(/);
  assert.match(panel, /disabled=\{!estado\.borrador\?\.valido \|\| Boolean\(accion\)\}/);
  // Volver al original lo cambia para todos: pide confirmacion.
  assert.match(panel, /<ConfirmDialog/);
});

test('los borradores se guardan solos al dejar de escribir, sin pasar por Historial', () => {
  const designer = leer('src/sections/everest/hooks/use-everest-designer.js');
  const servicio = leer('src/services/everest-borradores-service.js');

  assert.match(designer, /export const ESPERA_AUTOGUARDADO_MS = 1500;/);
  assert.match(
    designer,
    /setTimeout\(\s*\(\) => guardarYa\(idBloque\),\s*ESPERA_AUTOGUARDADO_MS\s*\)/
  );
  assert.doesNotMatch(servicio, /proponerCambio/);
  assert.match(leer('eslint.config.mjs'), /'src\/services\/everest-borradores-service\.js',/);
});
