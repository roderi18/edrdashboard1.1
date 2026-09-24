// ----------------------------------------------------------------------
// LAS VERSIONES DE EXPLORA DESIGNER (fase 5).
//
// Lo que se podia romper, y se comprueba aqui:
//
//   - Publicar sin dejar version: la publicacion quedaria en la portada sin
//     copia para volver atras. Por eso van en el MISMO lote, o las dos o ninguna.
//   - Que volver a una version la publicara en el acto, sin pasar por la vista
//     previa. Abrirla la deja como borrador; publicar sigue siendo un paso aparte.
//   - Que una version vieja, que ya no cuadra con la forma de hoy del bloque,
//     llegara al editor rota.
//   - Que Historial siguiera diciendo solo "Publicado desde EXPLORA Designer" sin
//     el antes y el despues de lo que cambio.
//   - Que listar las versiones pidiera un indice compuesto que hay que crear a
//     mano en la consola: sin el, la lista falla en produccion.
// ----------------------------------------------------------------------

import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { register } from 'node:module';
import assert from 'node:assert/strict';

register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

const {
  resumirValor,
  claveDeVersion,
  prepararVersion,
  ordenarVersiones,
  ACCIONES_DE_VERSION,
  publicacionDeVersion,
  diferenciasDelBloque,
} = await import('src/utils/everest/versiones.mjs');
const { FABRICA_DE_PORTADA } = await import('src/sections/principal/fabrica-de-portada.js');

const leer = (relativa) => fs.readFileSync(path.join(process.cwd(), relativa), 'utf8');

const ADMIN = { uid: 'u-1', displayName: 'Admin Global' };
const AHORA = new Date('2026-09-16T12:00:00.000Z');

// ----------------------------------------------------------------------
// LA FORMA DE UNA VERSION
// ----------------------------------------------------------------------

test('una version guarda que quedo en vivo, quien y cuando, y se busca por su clave', () => {
  const contenido = { titulo: 'Servir con alegría', pie: 'Siempre listos' };
  const version = prepararVersion({
    pantalla: 'principal',
    idBloque: 'lema',
    accion: ACCIONES_DE_VERSION.publicar,
    contenido,
    usuario: ADMIN,
    ahora: AHORA,
  });

  assert.deepEqual(version, {
    pantalla: 'principal',
    idBloque: 'lema',
    clave: 'principal/lema',
    accion: 'publicar',
    contenido,
    diseno: {},
    creadoEn: '2026-09-16T12:00:00.000Z',
    creadoPor: { uid: 'u-1', nombre: 'Admin Global' },
  });
  assert.equal(claveDeVersion('principal', 'lema'), 'principal/lema');
});

test('volver al original deja una version sin contenido, y una accion inventada no vale', () => {
  const version = prepararVersion({
    pantalla: 'principal',
    idBloque: 'lema',
    accion: ACCIONES_DE_VERSION.original,
    contenido: { titulo: 'no deberia guardarse' },
    ahora: AHORA,
  });

  assert.equal(version.contenido, null);
  assert.equal(version.diseno, null);
  assert.throws(() =>
    prepararVersion({ pantalla: 'principal', idBloque: 'lema', accion: 'borrar' })
  );
});

test('las versiones salen de la mas nueva a la mas vieja, sin las que no tienen forma', () => {
  const ordenadas = ordenarVersiones([
    { id: 'a', accion: 'publicar', creadoEn: '2026-09-01T00:00:00.000Z' },
    { id: 'b', accion: 'original', creadoEn: '2026-09-10T00:00:00.000Z' },
    { id: 'c', accion: 'inventada', creadoEn: '2026-09-11T00:00:00.000Z' },
    { id: 'd', accion: 'publicar' },
    null,
  ]);

  assert.deepEqual(
    ordenadas.map((version) => version.id),
    ['b', 'a']
  );
  assert.deepEqual(ordenarVersiones('no es una lista'), []);
});

// ----------------------------------------------------------------------
// ABRIR UNA VERSION
// ----------------------------------------------------------------------

test('una version publicada se abre saneada; la del original y la que ya no cuadra, no', () => {
  const publicada = {
    accion: 'publicar',
    idBloque: 'lema',
    contenido: { titulo: 'Servir con alegría', pie: 'Siempre listos' },
  };

  // Una version de antes del diseño no lo trae: se abre con uno vacio.
  assert.deepEqual(publicacionDeVersion(publicada), { contenido: publicada.contenido, diseno: {} });
  assert.deepEqual(
    publicacionDeVersion({ ...publicada, diseno: { colorFondo: '#00a76f' } }).diseno,
    { colorFondo: '#00A76F' }
  );
  assert.equal(publicacionDeVersion({ ...publicada, diseno: { colorFondo: 'rojo' } }), null);
  assert.equal(
    publicacionDeVersion({ accion: 'original', idBloque: 'lema', contenido: null }),
    null
  );
  assert.equal(publicacionDeVersion({ accion: 'publicar', idBloque: 'lema', contenido: 42 }), null);
  assert.equal(
    publicacionDeVersion({ accion: 'publicar', idBloque: 'encabezado-tienda', contenido: {} }),
    null
  );
  assert.equal(
    publicacionDeVersion({ accion: 'publicar', idBloque: 'no-existe', contenido: {} }),
    null
  );
});

test('abrir una version la deja como borrador: no publica', () => {
  const hook = leer('src/sections/everest/hooks/use-everest-designer.js');
  const inicio = hook.indexOf('const abrirVersion');
  const abrir = hook.slice(inicio, hook.indexOf('return {', inicio));

  assert.ok(inicio >= 0);
  assert.match(abrir, /anotar\(idBloque, pareja\)/);
  assert.doesNotMatch(abrir, /publicarBloque|volverBloqueAlOriginal/);
});

// ----------------------------------------------------------------------
// ESCRIBIR Y LEER
// ----------------------------------------------------------------------

test('publicar y volver al original escriben su version en el mismo lote', () => {
  const brazo = leer('src/services/everest-apply.js');

  // Solo lo de publicar y volver al original: las campañas van aparte, abajo.
  const publicacion = brazo.slice(0, brazo.indexOf('export const escribirCampana'));

  assert.equal(publicacion.match(/const lote = writeBatch\(FIRESTORE\);/g)?.length, 2);
  assert.equal(
    publicacion.match(/lote\.set\(referenciaDeVersionNueva\(\), version\);/g)?.length,
    2
  );
  assert.equal(publicacion.match(/lote\.commit\(\)/g)?.length, 2);
  assert.doesNotMatch(publicacion, /\b(setDoc|updateDoc|addDoc)\(/);
});

test('las versiones se leen por una sola igualdad, sin ordenar en la consulta', () => {
  const servicio = leer('src/services/everest-service.js');
  const lectura = servicio.slice(
    servicio.indexOf('async function obtenerVersionesDeBloqueSinCache')
  );

  assert.match(lectura, /where\('clave', '==', claveDeVersion\(pantalla, idBloque\)\)/);
  assert.doesNotMatch(lectura, /orderBy\(/);
  assert.match(lectura, /ordenarVersiones\(/);
});

test('la version publicada lleva la misma hora que la publicacion', () => {
  assert.match(
    leer('src/services/everest-service.js'),
    /ahora: new Date\(publicacion\.publicadoEn\)/
  );
});

// ----------------------------------------------------------------------
// ANTES Y DESPUES EN HISTORIAL
// ----------------------------------------------------------------------

test('Historial recibe solo los campos que cambiaron, con su antes y su despues', () => {
  const antes = FABRICA_DE_PORTADA['proxima-actividad'];
  const despues = {
    ...antes,
    titulo: 'Investidura Nacional',
    boton: { texto: 'Ver', destino: '/dashboard' },
  };
  const nombre = 'Próxima actividad';

  assert.deepEqual(diferenciasDelBloque({ idBloque: 'proxima-actividad', antes, despues }), [
    {
      campo: 'titulo',
      etiqueta: `${nombre} · titulo`,
      antes: resumirValor(antes.titulo),
      despues: 'Investidura Nacional',
    },
    {
      campo: 'boton',
      etiqueta: `${nombre} · boton`,
      antes: '—',
      despues: 'texto: Ver · destino: /dashboard',
    },
  ]);
  assert.deepEqual(
    diferenciasDelBloque({ idBloque: 'proxima-actividad', antes, despues: antes }),
    []
  );
});

test('un bloque que es una lista se compara entero y se resume con sus nombres', () => {
  const antes = [{ titulo: 'Uno' }, { titulo: 'Dos' }];
  const [cambio] = diferenciasDelBloque({ idBloque: 'comunicados', antes, despues: [antes[0]] });

  assert.equal(cambio.campo, 'comunicados');
  assert.equal(cambio.antes, '2 elementos: Uno, Dos');
  assert.equal(cambio.despues, '1 elemento: Uno');
});

test('un texto largo se recorta para que Historial se pueda leer', () => {
  const resumen = resumirValor('x'.repeat(500));

  assert.equal(resumen.length, 120);
  assert.ok(resumen.endsWith('…'));
});

test('el servicio manda a Historial las diferencias, y la ruta es la del Designer de hoy', () => {
  const servicio = leer('src/services/everest-service.js');

  assert.equal(servicio.match(/cambios: cambiosParaHistorial\(\{/g)?.length, 2);
  assert.match(servicio, /ruta: `\$\{paths\.dashboard\.everest\}\?bloque=\$\{bloque\.id\}`/);
  assert.doesNotMatch(servicio, /dashboard\/admin\/everest/);
});
