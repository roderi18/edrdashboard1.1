// ----------------------------------------------------------------------
// EL RESPALDO DIARIO EN LA NUBE.
//
// Qué se pedía: un respaldo total, cada día, del padrón de la API y de todo lo
// que hay en Firebase y Firestore, por si la aplicación quedara con 0 datos; y
// al hacerlo, un resumen en el chat de Administradores Globales. Antes el único
// respaldo era a mano desde Mantenimiento y el último tenía 41 días.
// ----------------------------------------------------------------------

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import '../soporte/resolver-alias-src.mjs';

const {
  revivirValor,
  carpetaDelDia,
  filasDelPadron,
  tamanoLegible,
  serializarValor,
  SERVICIOS_PADRON,
  textoResumenRespaldo,
  esCarpetaDiariaVencida,
} = await import('../../src/utils/respaldo-diario.mjs');
const { TAREAS_PROGRAMADAS } = await import('../../src/utils/tareas-programadas.mjs');

const leer = (ruta) => readFileSync(new URL(`../../${ruta}`, import.meta.url), 'utf8');

test('corre cada noche a las 11:00 p. m. de Santo Domingo', () => {
  const tarea = TAREAS_PROGRAMADAS.find((t) => t.id === 'respaldo-diario');

  assert.equal(tarea.horario, '0 23 * * *');
  assert.equal(tarea.zonaHoraria, 'America/Santo_Domingo');
  assert.match(leer('src/app/api/tareas/respaldo-diario/route.js'), /responderRespaldoDiario\(\)/);
});

test('el padrón entero: los diez servicios de la API .NET', () => {
  assert.deepEqual(
    SERVICIOS_PADRON.map((s) => s.id),
    [
      'miembros',
      'destacamentos',
      'secciones',
      'regiones',
      'iglesias',
      'divisiones',
      'paises',
      'cargos',
      'cargos_miembros',
      'tutores',
    ]
  );
  assert.equal(filasDelPadron({ data: [1, 2] }).length, 2);
  assert.equal(filasDelPadron([1]).length, 1);
});

test('las fechas y referencias de Firestore vuelven con su tipo al restaurar', () => {
  class Timestamp {
    constructor(s, ns) {
      this.seconds = s;
      this.nanoseconds = ns;
    }

    toDate() {
      return new Date(this.seconds * 1000);
    }
  }
  class GeoPoint {
    constructor(lat, lng) {
      this.latitude = lat;
      this.longitude = lng;
    }
  }
  const referencia = { path: 'miembros/1', collection: () => null };
  const guardado = serializarValor({
    fecha: new Timestamp(10, 5),
    dueno: referencia,
    lugar: new GeoPoint(18.4, -69.9),
    lista: [new Timestamp(1, 0)],
  });

  assert.deepEqual(guardado.fecha, { __tipo: 'fecha', s: 10, ns: 5 });
  assert.deepEqual(guardado.dueno, { __tipo: 'referencia', ruta: 'miembros/1' });

  const vuelto = revivirValor(JSON.parse(JSON.stringify(guardado)), {
    Timestamp,
    GeoPoint,
    referencia: (ruta) => `ref:${ruta}`,
  });

  assert.ok(vuelto.fecha instanceof Timestamp);
  assert.equal(vuelto.dueno, 'ref:miembros/1');
  assert.ok(vuelto.lugar instanceof GeoPoint);
  assert.ok(vuelto.lista[0] instanceof Timestamp);
});

test('se conservan 14 días; el espejo de archivos, siempre', () => {
  assert.equal(carpetaDelDia('2026-10-02'), 'respaldos/2026-10-02');
  assert.equal(
    esCarpetaDiariaVencida('respaldos/2026-09-18/firestore.json.gz', '2026-10-02'),
    true
  );
  assert.equal(
    esCarpetaDiariaVencida('respaldos/2026-09-19/firestore.json.gz', '2026-10-02'),
    false
  );
  assert.equal(esCarpetaDiariaVencida('respaldos/archivos/fotos/a.jpg', '2026-10-02'), false);
});

test('el mensaje del chat dice qué se guardó, cuánto se descargó y cuánto ocupa', () => {
  const texto = textoResumenRespaldo({
    partes: {
      firestore: {
        documentos: 11409,
        colecciones: 110,
        bytesLeidos: 15_000_000,
        bytesGuardados: 2_100_000,
      },
      padron: {
        servicios: [{ id: 'miembros', nombre: 'Miembros', filas: 1245 }],
        fallidos: 0,
        bytesLeidos: 3_300_000,
        bytesGuardados: 600_000,
      },
      cuentas: { total: 812, bytesGuardados: 90_000 },
      archivos: { total: 1018, bytesTotal: 192_600_000, copiados: 12, bytesCopiados: 4_300_000 },
    },
    fecha: new Date('2026-10-03T03:00:00Z'),
    duracionMs: 100_000,
    carpeta: 'respaldos/2026-10-02',
  });

  assert.match(texto, /^🗄️ Respaldo diario · viernes,? 2 de octubre/);
  assert.match(texto, /✅ Completo · 1 min 40 s/);
  assert.match(
    texto,
    /11\.409 documentos de 110 colecciones · descargado 14,3 MB, guardado 2,0 MB/
  );
  assert.match(texto, /1\.245 miembros/);
  assert.match(texto, /se copiaron 12 nuevos o cambiados \(4,1 MB\)/);
  assert.equal(tamanoLegible(500), '1 KB');
});

test('lo que falla sale arriba y el estado dice incompleto', () => {
  const texto = textoResumenRespaldo({
    fallos: [{ parte: 'Padrón (API .NET)', mensaje: 'la API .NET no respondió' }],
  });

  assert.match(texto, /🔴 Incompleto \(1 parte falló\)/);
  assert.match(texto, /🔴 Padrón \(API \.NET\): la API \.NET no respondió/);
});

test('la carpeta del respaldo no la abre nadie desde el navegador', () => {
  const reglas = leer('storage.rules');

  assert.match(reglas, /match \/respaldos\/\{allPaths=\*\*\} \{\s*allow read, write: if false;/);
  // El comodín de imágenes del Administrador Global no la alcanza. Por el NOMBRE
  // (texto): `rutaImagen` con `=**` es una ruta y `.matches` sobre ella daba
  // error, que deniega, y se cayeron las fotos de los productos.
  assert.match(reglas, /!resource\.name\.matches\('respaldos\/\.\*'\)/);
  assert.match(reglas, /!request\.resource\.name\.matches\('respaldos\/\.\*'\)/);
  assert.doesNotMatch(reglas, /rutaImagen\.matches/);
});

test('las fotos de los productos las suben el Administrador Global y el de Gestión de Tienda', () => {
  const reglas = leer('storage.rules');

  assert.match(
    reglas,
    /match \/productos\/\{allPaths=\*\*\} \{[\s\S]*?allow create, update: if \(esAdministradorGlobal\(\) \|\| esAdministradorDeTienda\(\)\)\s*&& esImagenPermitida\(\);/
  );
});
