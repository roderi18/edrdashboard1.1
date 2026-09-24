// ----------------------------------------------------------------------
// LA PORTADA NO CAMBIA HASTA QUE ALGUIEN LA PUBLICA DESDE EL DESIGNER.
//
// EXPLORA Designer (Administracion → EXPLORA Designer) va a poder cambiar todo lo
// que se ve en /principal. La condicion que se puso al encargarlo fue tajante:
// mientras nadie entre al Designer y pulse Publicar, la portada se ve EXACTAMENTE
// como hoy —textos, orden, imagenes y videos—.
//
// Esto es la red de seguridad de esa promesa, y se escribio ANTES de tocar nada
// (fase 0). Clava tres cosas:
//
//   1. Los valores de fabrica: lo que sale de `datos-de-ejemplo.js` y el lema
//      (`LEMA_DE_FABRICA`, que en la fase 2 salio de dentro de `PrincipalLema`
//      con el mismo texto). Son el respaldo de cada bloque que no se haya
//      publicado, asi que no pueden cambiar por accidente.
//   2. De donde salen las imagenes y los videos actuales de la bienvenida y de la
//      proxima actividad. El Designer no los mueve, ni los renombra, ni los borra.
//   3. Que cada bloque de la pantalla llega de ese valor de fabrica. Hasta la fase
//      1 se comprobaba que la vista importaba cada dato a mano; desde la fase 2 la
//      vista los pide al lector, y lo que se comprueba es la cadena entera: la
//      vista pinta lo que da el lector, y el lector sin publicacion da —el mismo
//      objeto, no una copia— lo de fabrica.
//
// Si uno de estos tests falla, la portada cambio sin que nadie la publicara.
// ----------------------------------------------------------------------

import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { register } from 'node:module';
import assert from 'node:assert/strict';

register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

const datos = await import('src/sections/principal/datos-de-ejemplo.js');
const { paths } = await import('src/routes/paths');
const { FABRICA_DE_PORTADA, LEMA_DE_FABRICA } =
  await import('src/sections/principal/fabrica-de-portada.js');
const { resolverPortada, ORIGEN_DEL_BLOQUE } = await import('src/utils/everest/portada.mjs');

const leer = (relativa) => fs.readFileSync(path.join(process.cwd(), relativa), 'utf8');

// ----------------------------------------------------------------------
// 1. LOS VALORES DE FABRICA
// ----------------------------------------------------------------------

test('la marca "Ejemplo" sigue apagada', () => {
  assert.equal(datos.HAY_DATOS_DE_EJEMPLO, false);
});

test('bienvenida: el lema, las cifras y el nivel de siempre', () => {
  assert.deepEqual(datos.RESUMEN_DE_EJEMPLO, {
    lema: 'Preparado para servir, aprender y liderar.',
    cifras: [
      {
        clave: 'actividades',
        valor: 12,
        etiqueta: 'Actividades',
        icono: 'solar:calendar-date-bold',
      },
      { clave: 'insignias', valor: 8, etiqueta: 'Insignias', icono: 'solar:medal-ribbon-bold' },
      {
        clave: 'asistencias',
        valor: 24,
        etiqueta: 'Asistencias',
        icono: 'solar:users-group-rounded-bold',
      },
    ],
    nivel: { numero: 4, nombre: 'Explorador', porcentaje: 82 },
  });
});

test('accesos rapidos: los cuatro, en su orden y con su destino', () => {
  assert.deepEqual(datos.ACCESOS_RAPIDOS, [
    {
      clave: 'registrar',
      titulo: 'Registrar actividad',
      icono: 'solar:calendar-date-bold',
      acento: 'azul',
      href: paths.dashboard.calendar,
    },
    {
      clave: 'proxima',
      titulo: 'Próxima actividad',
      icono: 'custom:calendar-agenda-outline',
      acento: 'verde',
      href: paths.dashboard.calendar,
    },
    {
      clave: 'insignias',
      titulo: 'Mis insignias',
      icono: 'solar:medal-star-bold',
      acento: 'ambar',
      href: paths.dashboard.certificates,
    },
    {
      clave: 'capacitacion',
      titulo: 'Capacitación',
      icono: 'solar:notebook-bold-duotone',
      acento: 'morado',
      href: paths.dashboard.fileManager,
    },
  ]);
});

test('proxima actividad: el campamento regional', () => {
  assert.deepEqual(datos.PROXIMA_ACTIVIDAD_DE_EJEMPLO, {
    titulo: 'Campamento Regional 2026',
    lugar: 'San José de los Llanos, Dajabón',
    fechas: '26 — 28 septiembre 2026',
    diasQueFaltan: 13,
    estado: 'Registrado',
  });
});

test('mi progreso: nivel, porcentaje y las tres areas', () => {
  assert.deepEqual(datos.MI_PROGRESO_DE_EJEMPLO, {
    nivel: 'Nivel Explorador 4',
    porcentaje: 82,
    hechas: 24,
    total: 30,
    areas: [
      { nombre: 'Campismo', estado: 'Completado', avance: 100, acento: 'verde' },
      { nombre: 'Primeros auxilios', estado: 'Completado', avance: 100, acento: 'azul' },
      { nombre: 'Alas de Bronce', estado: 'En progreso', avance: 40, acento: 'morado' },
    ],
  });
});

test('historias: las siete, en su orden', () => {
  assert.deepEqual(datos.HISTORIAS_DE_EJEMPLO, [
    { clave: 'campamento', titulo: 'Campamento Regional' },
    { clave: 'insignias', titulo: 'Insignias' },
    { clave: 'alas', titulo: 'Alas de Bronce' },
    { clave: 'destacamento', titulo: 'Destacamento 233' },
    { clave: 'eventos', titulo: 'Eventos' },
    { clave: 'formacion', titulo: 'Formación' },
    { clave: 'vida', titulo: 'Vida del ER' },
  ]);
});

test('proximos eventos: los tres, con su fecha y su color', () => {
  assert.deepEqual(datos.EVENTOS_DE_EJEMPLO, [
    {
      clave: 'campamento-regional',
      dia: '26',
      mes: 'SEP',
      titulo: 'Campamento Regional 2026',
      lugar: 'San José de los Llanos, Dajabón',
      estado: 'Registrado',
      color: 'success',
    },
    {
      clave: 'alas-bronce',
      dia: '03',
      mes: 'OCT',
      titulo: 'Alas de Bronce',
      lugar: 'Sede Central, Santo Domingo',
      estado: 'Por confirmar',
      color: 'info',
    },
    {
      clave: 'promocion',
      dia: '17',
      mes: 'OCT',
      titulo: 'Ceremonia de Promoción',
      lugar: 'Templo El Redentor, Santo Domingo',
      estado: 'Pendiente',
      color: 'warning',
    },
  ]);
});

test('destacamento destacado: Halcones del Este', () => {
  assert.deepEqual(datos.DESTACAMENTO_DESTACADO_DE_EJEMPLO, {
    nombre: 'Destacamento 52 — Halcones del Este',
    region: 'Región Central',
    miembros: 38,
    valoracion: 4.9,
  });
});

test('comunicados oficiales: los dos de la Direccion Nacional', () => {
  assert.deepEqual(datos.COMUNICADOS_DE_EJEMPLO, [
    {
      clave: 'competencias',
      origen: 'Dirección Nacional',
      titulo: 'Convocatoria Nacional de Competencias 2026',
      fecha: '13 sep 2026',
    },
    {
      clave: 'lineamientos',
      origen: 'Dirección Nacional',
      titulo: 'Nuevos lineamientos de capacitación',
      fecha: '05 sep 2026',
    },
  ]);
});

test('el lema de la columna: el mismo texto, con el mismo salto de linea', () => {
  // Hasta la fase 1 estaba escrito dentro de `PrincipalLema` como
  // "Más que una organización,<br />una familia." y "Servir · Liderar · Transformar".
  assert.deepEqual(LEMA_DE_FABRICA, {
    titulo: 'Más que una organización,\nuna familia.',
    pie: 'Servir · Liderar · Transformar',
  });

  // Y el componente pinta el salto como el `<br />` de antes, con el mismo escudo.
  const lateral = leer('src/sections/principal/principal-lateral.jsx');
  const lema = lateral.slice(lateral.indexOf('export function PrincipalLema'));

  // Desde el diseño recibe tambien `diseno` y `puedeEditar`; el lema por defecto sigue.
  assert.match(lema, /export function PrincipalLema\(\{ lema = LEMA_DE_FABRICA,/);
  assert.match(lema, /\.split\('\\n'\)/);
  assert.match(lema, /\{indice > 0 && <br \/>\}/);
  assert.match(lema, /'solar:shield-check-bold'/);
});

// ----------------------------------------------------------------------
// 2. LAS IMAGENES Y LOS VIDEOS DE HOY
// ----------------------------------------------------------------------

test('las tarjetas siguen leyendo su foto o video de donde lo leen hoy', () => {
  const imagen = leer('src/sections/principal/imagen-de-tarjeta.jsx');

  assert.match(imagen, /const TIPO_DE_ENTIDAD = 'principalTarjeta';/);
  assert.match(imagen, /tipoFoto: 'portada'/);

  assert.match(
    leer('src/sections/principal/principal-bienvenida.jsx'),
    /const ID_DEL_BANNER = 'bienvenida';[\s\S]*useImagenDeTarjeta\(ID_DEL_BANNER\)/
  );
  assert.match(
    leer('src/sections/principal/principal-actividad.jsx'),
    /const ID_DE_LA_TARJETA = 'proxima-actividad';[\s\S]*useImagenDeTarjeta\(ID_DE_LA_TARJETA, \{\s*aceptaVideo: true,?\s*\}\)/
  );
});

test('los archivos de las tarjetas en Storage no se pueden borrar', () => {
  const reglas = leer('storage.rules');
  const bloque = reglas.slice(reglas.indexOf('match /principal-tarjetas/{idTarjeta}/{archivo}'));

  assert.ok(bloque.length < reglas.length, 'falta el bloque de principal-tarjetas');
  assert.match(bloque.slice(0, 700), /allow delete: if false;/);
});

// ----------------------------------------------------------------------
// 3. CADA BLOQUE LLEGA DE SU VALOR DE FABRICA (desde la fase 2, por el lector)
// ----------------------------------------------------------------------

// Que componente recibe que bloque. Cambiar un bloque de sitio es cambiar la
// portada, asi que tambien se clava. Los accesos rápidos no están: se quitaron
// de la portada a propósito (commit 8bdfaf66) y el bloque quedó `retirado`.
const QUE_PINTA_CADA_BLOQUE = {
  bienvenida: /resumen=\{portada\.bienvenida\.contenido\}/,
  'proxima-actividad': /actividad=\{portada\['proxima-actividad'\]\.contenido\}/,
  'mi-progreso': /progreso=\{portada\['mi-progreso'\]\.contenido\}/,
  historias: /historias=\{portada\.historias\.contenido\}/,
  'proximos-eventos': /eventos=\{portada\['proximos-eventos'\]\.contenido\}/,
  'destacamento-destacado': /destacado=\{portada\['destacamento-destacado'\]\.contenido\}/,
  comunicados: /comunicados=\{portada\.comunicados\.contenido\}/,
  lema: /<PrincipalLema\s+lema=\{portada\.lema\.contenido\}/,
};

test('la portada pinta cada bloque con lo que le da el lector, sin datos importados a mano', () => {
  const vista = leer('src/sections/principal/view/principal-home-view.jsx');

  assert.match(vista, /const portada = useContenidoDePortada\(\{ quien \}\);/);
  Object.entries(QUE_PINTA_CADA_BLOQUE).forEach(([idBloque, patron]) => {
    assert.match(vista, patron, idBloque);
  });
  assert.doesNotMatch(
    vista,
    /RESUMEN_DE_EJEMPLO|ACCESOS_RAPIDOS|PROXIMA_ACTIVIDAD_DE_EJEMPLO|MI_PROGRESO_DE_EJEMPLO|HISTORIAS_DE_EJEMPLO|EVENTOS_DE_EJEMPLO|DESTACAMENTO_DESTACADO_DE_EJEMPLO|COMUNICADOS_DE_EJEMPLO/
  );
});

test('cada valor de fabrica es el MISMO objeto que usaba la pantalla', () => {
  // Identidad, no solo igualdad: nada se copio ni se transformo por el camino.
  assert.equal(FABRICA_DE_PORTADA.bienvenida, datos.RESUMEN_DE_EJEMPLO);
  assert.equal(FABRICA_DE_PORTADA['accesos-rapidos'], datos.ACCESOS_RAPIDOS);
  assert.equal(FABRICA_DE_PORTADA['proxima-actividad'], datos.PROXIMA_ACTIVIDAD_DE_EJEMPLO);
  assert.equal(FABRICA_DE_PORTADA['mi-progreso'], datos.MI_PROGRESO_DE_EJEMPLO);
  assert.equal(FABRICA_DE_PORTADA.historias, datos.HISTORIAS_DE_EJEMPLO);
  assert.equal(FABRICA_DE_PORTADA['proximos-eventos'], datos.EVENTOS_DE_EJEMPLO);
  assert.equal(
    FABRICA_DE_PORTADA['destacamento-destacado'],
    datos.DESTACAMENTO_DESTACADO_DE_EJEMPLO
  );
  assert.equal(FABRICA_DE_PORTADA.comunicados, datos.COMUNICADOS_DE_EJEMPLO);
  assert.equal(FABRICA_DE_PORTADA.lema, LEMA_DE_FABRICA);
});

test('sin nada publicado, el lector da lo de fabrica a cada bloque que pinta la portada', () => {
  const portada = resolverPortada({
    publicado: null,
    fabrica: FABRICA_DE_PORTADA,
    pantalla: 'principal',
  });

  Object.keys(QUE_PINTA_CADA_BLOQUE).forEach((idBloque) => {
    assert.equal(portada[idBloque].origen, ORIGEN_DEL_BLOQUE.codigo, idBloque);
    assert.equal(portada[idBloque].contenido, FABRICA_DE_PORTADA[idBloque], idBloque);
  });
});
