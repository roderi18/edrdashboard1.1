// ----------------------------------------------------------------------
// LA AUDITORIA DE SEGURIDAD LA ESCRIBE EL SERVIDOR, Y NO SE LE ESCAPA NADA.
//
// Que se rompia: las rutas de `/api/auth` y `/api/admin` no dejaban rastro.
// Generar un codigo de recuperacion, entrar con el, cambiar la contraseña o el
// correo de acceso, repartir roles o entrar como otra persona pasaba sin
// constancia; un bloqueo por intentos o un 403 tampoco. La auditoria que habia
// la escribia el navegador —quien se salta la pantalla no la genera—, cualquier
// sesion podia dejar entradas sin autor y cualquier sesion la leia entera.
// ----------------------------------------------------------------------

import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { readFile } from 'node:fs/promises';

register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

const {
  RETENCION_DIAS,
  unaVezCada,
  severidadDe,
  limpiarDetalle,
  contextoDePeticion,
  ACCIONES_DE_SEGURIDAD,
  escribirEnLogDelServidor,
  registrarEnLogDelServidor,
  construirEventoDeSeguridad,
} = await import('../../src/utils/auditoria-seguridad.mjs');
const { COLECCIONES } = await import('../../src/config/esquema-firestore.mjs');

const leer = (ruta) => readFile(new URL(`../../${ruta}`, import.meta.url), 'utf8');

const peticion = (url, cabeceras = {}) => ({
  url,
  headers: { get: (nombre) => cabeceras[nombre.toLowerCase()] ?? null },
});

// --- la forma del evento ---

test('el evento lleva quien, que, a quien, desde donde y cuando caduca', () => {
  const ahora = Date.parse('2026-10-05T12:00:00Z');
  const evento = construirEventoDeSeguridad({
    accion: ACCIONES_DE_SEGURIDAD.correoCambiado,
    actor: { uid: 'u1', idMiembros: 10, rol: 'coordinador_destacamento', extra: 'no' },
    objetivo: { uid: 'u2', email: 'ana@example.com' },
    detalle: { anterior: 'a@x.com', nuevo: 'b@x.com' },
    ip: '203.0.113.7',
    userAgent: 'Navegador',
    ruta: '/api/auth/correo-cuenta-miembro',
    ahora,
  });

  assert.equal(evento.accion, 'correo_acceso_cambiado');
  assert.equal(evento.resultado, 'ok');
  assert.deepEqual(evento.actor, {
    uid: 'u1',
    idMiembros: '10',
    codigoMiembro: null,
    correo: null,
    rol: 'coordinador_destacamento',
  });
  assert.equal(evento.objetivo.correo, 'ana@example.com');
  assert.equal(evento.ip, '203.0.113.7');
  assert.equal(evento.fecha, '2026-10-05T12:00:00.000Z');
  assert.equal(
    evento.expiraEn.getTime() - ahora,
    RETENCION_DIAS * 24 * 60 * 60 * 1000,
    'caduca a los RETENCION_DIAS'
  );
});

test('una accion o un resultado fuera del catalogo no se aceptan', () => {
  assert.throws(() => construirEventoDeSeguridad({ accion: 'clave_cambiad' }), /desconocida/);
  assert.throws(
    () => construirEventoDeSeguridad({ accion: ACCIONES_DE_SEGURIDAD.claveCambiada, resultado: 'quizas' }),
    /desconocido/
  );
});

test('los secretos nunca entran en el registro, esten donde esten', () => {
  const limpio = limpiarDetalle({
    codigo: 'K7P2XQ9A',
    clave: 'Verde-Montaña-72',
    password: 'x',
    token: 'eyJ...',
    accessToken: 'eyJ...',
    huella: 'abc',
    sal: 'def',
    codigoMiembro: 'EDR-10049',
    anidado: { claveNueva: 'y', idToken: 'z', numero: '10049' },
    lista: [{ secreto: 's', ok: true }],
  });

  assert.deepEqual(limpio, {
    codigoMiembro: 'EDR-10049',
    anidado: { numero: '10049' },
    lista: [{ ok: true }],
  });
});

test('los textos largos se recortan y lo muy anidado se omite', () => {
  const largo = limpiarDetalle({ texto: 'x'.repeat(1000) });

  assert.ok(largo.texto.length <= 301);
  assert.deepEqual(limpiarDetalle({ a: { b: { c: { d: 1 } } } }), { a: { b: { c: '[omitido]' } } });
});

test('lo que no salio bien se ve como advertencia en Cloud Logging', () => {
  assert.equal(severidadDe('ok'), 'INFO');
  assert.equal(severidadDe('fallo'), 'WARNING');
  assert.equal(severidadDe('denegado'), 'WARNING');
  assert.equal(severidadDe('bloqueado'), 'WARNING');
});

// --- el log del servidor ---

test('la linea de log es JSON con severidad, sin caducidad ni secretos', () => {
  const lineas = [];
  const evento = construirEventoDeSeguridad({
    accion: ACCIONES_DE_SEGURIDAD.accesoConCodigo,
    resultado: 'fallo',
    detalle: { numero: '10049', codigo: 'K7P2XQ9A' },
  });

  escribirEnLogDelServidor(evento, (linea) => lineas.push(linea));

  const datos = JSON.parse(lineas[0]);

  assert.equal(datos.severity, 'WARNING');
  assert.equal(datos.message, '[seguridad] acceso_con_codigo fallo');
  assert.equal(datos.tipo, 'auditoria_seguridad');
  assert.equal(datos.expiraEn, undefined);
  assert.doesNotMatch(lineas[0], /K7P2XQ9A/);
});

test('el contexto sale de la peticion: IP real, navegador y ruta sin consulta', () => {
  const contexto = contextoDePeticion(
    peticion('https://app.example/api/auth/recuperacion?x=1', { 'user-agent': 'Navegador' }),
    () => '203.0.113.7'
  );

  assert.deepEqual(contexto, {
    ip: '203.0.113.7',
    userAgent: 'Navegador',
    ruta: '/api/auth/recuperacion',
  });
});

test('lo que se repite en rafaga se registra una vez por ventana', () => {
  const clave = `prueba:${Math.random()}`;

  assert.equal(unaVezCada(clave, 1000, 0), true);
  assert.equal(unaVezCada(clave, 1000, 500), false);
  assert.equal(unaVezCada(clave, 1000, 1500), true);
});

test('registrar solo en el log nunca lanza, aunque el evento venga mal', () => {
  const original = console.error;
  console.error = () => {};

  try {
    assert.equal(registrarEnLogDelServidor(peticion('https://x/y'), { accion: 'inventada' }), null);
  } finally {
    console.error = original;
  }
});

// --- donde se registra ---

const RUTAS_Y_EVENTOS = {
  'src/app/api/auth/codigo-restablecimiento/route.js': ['codigoGenerado', 'codigoDenegado', 'cuentaCreada'],
  'src/app/api/auth/acceso-con-codigo/route.js': ['accesoConCodigo', 'codigoCongelado'],
  'src/app/api/auth/recuperacion/route.js': ['recuperacionConsultada', 'ayudaCoordinadorSolicitada'],
  'src/app/api/auth/clave-miembro/route.js': ['claveCambiada'],
  'src/app/api/auth/correo-cuenta-miembro/route.js': ['correoCambiado', 'correoDenegado', 'cuentaCreada'],
  'src/app/api/auth/crear-cuenta-miembro/route.js': ['cuentaCreada', 'accesoDenegado'],
  'src/app/api/auth/correo-acceso/route.js': ['correoDeAccesoConsultado'],
  'src/app/api/auth/correo-acceso-administrador/route.js': ['correoDeAccesoConsultado'],
  'src/app/api/auth/sincronizar-rol/route.js': [
    'sesionIniciada',
    'administradorGlobalCreado',
    'rolSincronizado',
  ],
  'src/app/api/admin/asignar-rol-administracion/route.js': [
    'rolAdministracionAsignado',
    'rolAdministracionDenegado',
  ],
  'src/app/api/admin/set-user-claims/route.js': ['claimsFijados', 'accesoDenegado'],
  'src/app/api/admin/switch-own-role/route.js': ['rolPropioCambiado', 'accesoDenegado'],
  'src/app/api/admin/sincronizar-roles/route.js': ['rolesSincronizados', 'accesoDenegado'],
  'src/app/api/admin/probar-como-usuario/route.js': [
    'suplantacionIniciada',
    'suplantacionTerminada',
    'suplantacionDenegada',
  ],
  'src/server/limite-intentos.js': ['limiteSuperado'],
  'src/server/require-role.js': ['accesoDenegado', 'sesionRevocadaUsada'],
  'src/app/api/members/route.js': ['padronConsultado'],
};

test('cada ruta sensible registra sus eventos', async () => {
  for (const [ruta, eventos] of Object.entries(RUTAS_Y_EVENTOS)) {
    const fuente = await leer(ruta);

    for (const evento of eventos) {
      assert.match(
        fuente,
        new RegExp(`ACCIONES_DE_SEGURIDAD\\.${evento}\\b`),
        `${ruta} no registra ${evento}`
      );
    }
  }
});

test('ninguna accion del catalogo se queda sin usar', async () => {
  const fuentes = (await Promise.all(Object.keys(RUTAS_Y_EVENTOS).map(leer))).join('\n');

  for (const clave of Object.keys(ACCIONES_DE_SEGURIDAD)) {
    assert.match(fuentes, new RegExp(`ACCIONES_DE_SEGURIDAD\\.${clave}\\b`), `${clave} no se usa`);
  }
});

test('las rutas de roles verifican con revocacion y el perfil manda sobre el claim', async () => {
  for (const ruta of [
    'src/app/api/admin/asignar-rol-administracion/route.js',
    'src/app/api/admin/switch-own-role/route.js',
    'src/app/api/admin/sincronizar-roles/route.js',
    'src/app/api/auth/sincronizar-rol/route.js',
  ]) {
    const fuente = await leer(ruta);

    assert.match(fuente, /verificarTokenDeSesion\(token\)/, ruta);
    assert.doesNotMatch(fuente, /auth\.verifyIdToken\(token\)/, ruta);
  }

  assert.match(
    await leer('src/app/api/admin/asignar-rol-administracion/route.js'),
    /suAsignacion\?\.rolId \|\| quienLlama\.rol/
  );
  assert.match(
    await leer('src/app/api/admin/sincronizar-roles/route.js'),
    /suAsignacion\?\.data\(\)\?\.rolId \|\| caller\.rol/
  );
});

test('el padron se registra sin cargar el Admin SDK', async () => {
  const fuente = await leer('src/app/api/members/route.js');

  assert.match(fuente, /registrarEnLogDelServidor\(/);
  // (El comentario de la ruta explica por que no lo carga: se miran los import.)
  assert.doesNotMatch(
    fuente,
    /from '(firebase-admin[^']*|src\/server\/firebase-admin|src\/server\/auditoria-seguridad)'/
  );
});

test('el registro de seguridad nunca tumba la peticion', async () => {
  const fuente = await leer('src/server/auditoria-seguridad.js');

  // Todo dentro de try/catch, con tope de espera para Firestore.
  assert.match(fuente, /TOPE_ESCRITURA_MS = 2000/);
  assert.match(fuente, /catch \(error\) \{\s*console\.error\('\[auditoria-seguridad\] evento descartado'/);
  // Y siempre deja la linea de log, aunque no se persista.
  assert.ok(
    fuente.indexOf('escribirEnLogDelServidor(evento)') < fuente.indexOf('if (!persistir'),
    'el log va antes de decidir si se guarda'
  );
});

// --- las reglas ---

test('auditoria_seguridad: solo el servidor la escribe y solo el Administrador Global la lee', async () => {
  const reglas = await leer('firestore.rules');

  assert.equal(COLECCIONES.auditoriaSeguridad, 'auditoria_seguridad');
  assert.match(
    reglas,
    /match \/auditoria_seguridad\/\{idEvento\} \{\s*allow read: if esAdministradorGlobal\(\);\s*allow write: if false;/
  );

  // Ni el comodin general ni el pase del Administrador Global la escriben.
  const exclusiones = reglas.match(/&& coleccion != 'auditoria_seguridad'/g) || [];
  assert.equal(exclusiones.length, 3);
});

test('auditoria_sistema: la firma quien escribe y la lee quien tiene permiso', async () => {
  const [reglas, servicio] = await Promise.all([
    leer('firestore.rules'),
    leer('src/services/audit-log-service.js'),
  ]);
  const bloque = reglas.slice(
    reglas.indexOf('match /auditoria_sistema/{idEvento}'),
    reglas.indexOf('match /auditoria_seguridad/{idEvento}')
  );

  assert.match(bloque, /allow read: if puedeVerAuditoria\(\);/);
  assert.match(bloque, /laAuditoriaLaFirmaQuienEscribe\(\)/);
  assert.match(bloque, /allow update: if false;/);
  assert.match(
    bloque,
    /allow delete: if esAdministradorGlobal\(\) && resource\.data\.origen == 'prueba_localhost';/
  );
  assert.match(
    reglas,
    /request\.resource\.data\.get\('registradoPorUid', ''\) == request\.auth\.uid/
  );
  assert.match(servicio, /registradoPorUid: AUTH\?\.currentUser\?\.uid \?\? null/);

  const funcion = reglas.slice(
    reglas.indexOf('function puedeVerAuditoria()'),
    reglas.indexOf('function laAuditoriaLaFirmaQuienEscribe()')
  );

  assert.match(funcion, /tienePermisoDeCargo\('administracion\.ver_auditoria'\)/);
  assert.doesNotMatch(funcion, /esUsuarioDelSistema/);
});

test('las llaves del archivo de reglas cuadran', async () => {
  const reglas = await leer('firestore.rules');

  assert.equal((reglas.match(/\{/g) || []).length, (reglas.match(/\}/g) || []).length);
});
