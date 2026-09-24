// ----------------------------------------------------------------------
// EL CHAT DE SISTEMA: AVISOS QUE SE LEEN Y NO SE CONTESTAN.
//
// Sistema (20003) avisa por el chat de los cumpleaños del destacamento: una
// semana antes, el dia antes y el mismo dia, UN SOLO mensaje con la lista a cada
// persona con cuenta del destacamento, Pastor incluido. Lo que no puede romperse:
//
// - nadie le contesta ni se hace pasar por el (servidor, reglas y sesion);
// - el cumpleañero no recibe su propio cumpleaños en la lista, y el dia recibe
//   su felicitacion;
// - una segunda pasada del mismo dia no repite mensajes ni suma no leidos;
// - el registro cuenta solo lo que de verdad salio.
// ----------------------------------------------------------------------

import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { register } from 'node:module';
import assert from 'node:assert/strict';

register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

const {
  CUENTA_SISTEMA,
  cuandoCumple,
  fraseDeCumpleanos,
  esConversacionDeSistema,
  idConversacionConSistema,
  CODIGO_CHAT_SOLO_LECTURA,
} = await import('src/utils/chat-sistema.mjs');
const { esIdReservadoDeBuzon } = await import('src/utils/chat-buzones.mjs');
const { CHAT_PERMISSIONS, authorizeConversationOperation } =
  await import('src/server/chat-authorization-core.mjs');
const { createChatMessageDocument, chatMessageToUi } =
  await import('src/server/chat-message-model.mjs');
const { registroDelEnvio, repartoDelChatDeCumpleanos } =
  await import('src/server/chat-sistema-cumpleanos.mjs');
const { escribirMensajesDeSistema } = await import('src/server/chat-sistema-envio.mjs');

const leer = (ruta) => fs.readFileSync(path.join(process.cwd(), ruta), 'utf8');

const DEST = { idDestacamento: 231, idDestacamentoNavigation: { nombre: 'Tribu de Judá' } };
const RANDY = { idMiembros: 367, nombres: 'Randy Samuel', apellidos: 'Cruz Martinez', ...DEST };
const ANA = { idMiembros: 10, nombres: 'Ana', apellidos: 'Gil', ...DEST };
const PASTOR = { idMiembros: 11, nombres: 'Pedro', apellidos: 'Pastor', ...DEST };
const SIN_CUENTA = { idMiembros: 12, nombres: 'Luis', apellidos: 'Sin Cuenta', ...DEST };
const DE_OTRO = { idMiembros: 13, nombres: 'Eva', apellidos: 'Otra', idDestacamento: 240 };
const MIEMBROS = [RANDY, ANA, PASTOR, SIN_CUENTA, DE_OTRO];
const CUENTAS = { 367: ['u367'], 10: ['u10'], 11: ['u11'], 13: ['u13'] };

const repartoDe = (cumpleaneros) =>
  repartoDelChatDeCumpleanos({
    cumpleaneros,
    miembros: MIEMBROS,
    cuentasPorMiembro: CUENTAS,
    fotos: { 367: { grande: 'https://fotos.test/randy.webp', mini: '' } },
    fechaClave: '2026-09-18',
  });

// ----------------------------------------------------------------------
// NADIE LE CONTESTA NI SE HACE PASAR POR EL
// ----------------------------------------------------------------------

test('el 20003 es de Sistema: ninguna sesion puede usarlo', () => {
  assert.equal(CUENTA_SISTEMA.idMiembros, 20003);
  assert.equal(esIdReservadoDeBuzon(20003), true);
  assert.equal(esIdReservadoDeBuzon(367), false);
});

test('el servidor rechaza escribir en la conversacion con Sistema, pero deja leerla', () => {
  const conversacion = { participantesIds: [367, 20003] };
  const actor = { idMiembros: 367 };

  assert.throws(
    () =>
      authorizeConversationOperation({
        actor,
        conversation: conversacion,
        permission: CHAT_PERMISSIONS.SEND,
      }),
    (error) => error.status === 403 && error.code === CODIGO_CHAT_SOLO_LECTURA
  );
  assert.equal(
    authorizeConversationOperation({
      actor,
      conversation: conversacion,
      permission: CHAT_PERMISSIONS.VIEW,
    }),
    367
  );
  // Y en una conversacion normal se sigue escribiendo.
  assert.equal(
    authorizeConversationOperation({
      actor,
      conversation: { participantesIds: [367, 10] },
      permission: CHAT_PERMISSIONS.SEND,
    }),
    367
  );
});

test('la pantalla reconoce la conversacion de Sistema por sus participantes', () => {
  assert.equal(esConversacionDeSistema({ participants: [{ id: '367' }, { id: '20003' }] }), true);
  assert.equal(esConversacionDeSistema({ participants: [{ id: '367' }, { id: '10' }] }), false);
  assert.equal(idConversacionConSistema(367), 'individual_367_20003');
  // Por el id basta: se sabe desde la direccion, antes de que carguen los participantes.
  assert.equal(esConversacionDeSistema({ id: 'individual_367_20003' }), true);
  assert.equal(esConversacionDeSistema({ id: 'individual_367_20004' }), false);
  assert.equal(esConversacionDeSistema({ id: 'grupal_20003' }), false);
});

test('la caja de escribir se sustituye por el aviso en la conversacion de Sistema', () => {
  const caja = leer('src/sections/chat/chat-message-input.jsx');

  assert.match(caja, /export function ChatMessageInput\(props\)/);
  assert.match(caja, /esConversacionDeSistema\(\{ id: selectedConversationId \}\)/);
  assert.match(caja, /\{AVISO_CHAT_SOLO_LECTURA\}/);
});

test('las reglas: nadie lleva el 20003, nadie le abre conversacion ni le escribe', () => {
  const reglas = leer('firestore.rules');

  assert.match(reglas, /&& request\.auth\.token\.idMiembros != 20003;/);
  assert.match(reglas, /&& !\(20003 in request\.resource\.data\.participantesIds\)/);
  // A Sistema no se le contesta. Única excepción (f3642a99): el grupo
  // "ADMINISTRADORES GLOBALES" también recibe avisos de Sistema, y entre ellos,
  // siendo Administradores Globales, sí pueden escribirse.
  assert.match(
    reglas,
    /!\(20003 in conversacion\(idConversacion\)\.participantesIds\)\s*\|\|\s*\(\s*conversacion\(idConversacion\)\.tipoConversacion == 'GRUPAL'\s*&& conversacion\(idConversacion\)\.nombreGrupo == 'ADMINISTRADORES GLOBALES'\s*&& esAdministradorGlobal\(\)/
  );
  assert.match(leer('storage.rules'), /&& idMiembroChat\(\) != 20003;/);
});

test('el registro lo lee solo el Administrador Global y el comodin no lo abre', () => {
  const reglas = leer('firestore.rules');

  assert.match(
    reglas,
    /match \/chat_sistema_registro\/\{idRegistro\} \{\s*allow read: if esAdministradorGlobal\(\);\s*allow write: if false;/
  );
  assert.match(reglas, /&& coleccion != 'chat_sistema_registro'/);
});

// ----------------------------------------------------------------------
// EL MENSAJE
// ----------------------------------------------------------------------

test('la tarjeta de cumpleaños sobrevive a la limpieza del mensaje, y lo roto no', () => {
  const documento = createChatMessageDocument({
    message: {
      idMensaje: 'sistema_cumpleanos_2026-09-18',
      texto: 'Cumpleaños',
      remitenteIdMiembros: 20003,
      metadatos: {
        cumpleanosSistema: {
          personas: [
            { idMiembros: 367, nombre: 'Randy', dias: 0, fotoUrl: 'https://fotos.test/r.webp' },
            { idMiembros: 10, nombre: 'Ana', dias: 7, fotoUrl: 'javascript:alert(1)' },
            { idMiembros: -1, nombre: 'Roto', dias: 1 },
            { idMiembros: 11, nombre: '', dias: 1 },
          ],
        },
      },
    },
    conversationId: 'individual_367_20003',
  });

  assert.deepEqual(chatMessageToUi(documento).metadata.cumpleanosSistema, {
    personas: [
      { idMiembros: 367, nombre: 'Randy', dias: 0, fotoUrl: 'https://fotos.test/r.webp' },
      { idMiembros: 10, nombre: 'Ana', dias: 7 },
    ],
  });
});

test('cuando cumple se dice igual en el texto y en la tarjeta', () => {
  assert.equal(cuandoCumple(0), 'Hoy');
  assert.equal(cuandoCumple(1), 'Mañana');
  assert.equal(cuandoCumple(7), 'En 7 días');
  assert.equal(
    fraseDeCumpleanos('Randy Samuel Cruz Martinez', 0),
    'Randy Samuel Cruz Martinez está de cumpleaños hoy 🎊'
  );
  assert.equal(fraseDeCumpleanos('Ana Gil', 1), 'Ana Gil está de cumpleaños mañana 🎉');
});

// ----------------------------------------------------------------------
// EL REPARTO
// ----------------------------------------------------------------------

test('llega a todos los del destacamento con cuenta, Pastor incluido, y a nadie mas', () => {
  const [envio] = repartoDe([{ miembro: ANA, dias: 7 }]);
  const receptores = envio.mensajes.map((mensaje) => mensaje.idMiembros).sort((a, b) => a - b);

  // Ana no recibe su propio aviso; Luis no tiene cuenta; Eva es de otro.
  assert.deepEqual(receptores, [11, 367]);
  assert.equal(envio.nombreDestacamento, 'Tribu de Judá');
  // Sin encabezado: una frase por persona.
  assert.equal(envio.mensajes[0].texto, 'Ana Gil está de cumpleaños en 7 días 🎂');
});

test('el dia del cumpleaños, el cumpleañero recibe su felicitacion y los demas la lista', () => {
  const [envio] = repartoDe([{ miembro: RANDY, dias: 0 }]);
  const deRandy = envio.mensajes.filter((mensaje) => mensaje.idMiembros === 367);
  const deAna = envio.mensajes.find((mensaje) => mensaje.idMiembros === 10);

  assert.equal(deRandy.length, 1);
  assert.equal(deRandy[0].idMensaje, 'sistema_felicitacion_2026-09-18');
  assert.match(deRandy[0].texto, /¡Feliz cumpleaños, Randy!/);
  assert.equal(deRandy[0].metadatos.cumpleanosSistema.felicitacion, true);

  assert.equal(deAna.idMensaje, 'sistema_cumpleanos_2026-09-18');
  assert.deepEqual(deAna.metadatos.cumpleanosSistema.personas, [
    {
      idMiembros: 367,
      nombre: 'Randy Samuel Cruz Martinez',
      dias: 0,
      fotoUrl: 'https://fotos.test/randy.webp',
    },
  ]);
});

test('el dia antes, el cumpleañero no recibe nada de si mismo', () => {
  const [envio] = repartoDe([{ miembro: RANDY, dias: 1 }]);

  assert.equal(
    envio.mensajes.some((mensaje) => mensaje.idMiembros === 367),
    false
  );
});

test('con varios cumpleaños el mismo dia, un solo mensaje con la lista, el mas cercano primero', () => {
  const [envio] = repartoDe([
    { miembro: ANA, dias: 7 },
    { miembro: RANDY, dias: 1 },
  ]);
  const dePastor = envio.mensajes.filter((mensaje) => mensaje.idMiembros === 11);

  assert.equal(dePastor.length, 1);
  assert.deepEqual(
    dePastor[0].metadatos.cumpleanosSistema.personas.map((persona) => persona.nombre),
    ['Randy Samuel Cruz Martinez', 'Ana Gil']
  );
  // Randy ve solo a Ana; Ana, solo a Randy.
  assert.deepEqual(
    envio.mensajes
      .find((mensaje) => mensaje.idMiembros === 367)
      .metadatos.cumpleanosSistema.personas.map((persona) => persona.idMiembros),
    [10]
  );
});

// ----------------------------------------------------------------------
// LA ESCRITURA Y EL REGISTRO
// ----------------------------------------------------------------------

// Un Firestore de mentira con lo que usa `escribirMensajesDeSistema`.
const crearBaseDeDatos = () => {
  const documentos = new Map();
  const referencia = (ruta) => ({
    ruta,
    collection: (nombre) => ({ doc: (id) => referencia(`${ruta}/${nombre}/${id}`) }),
    get: async () => ({ exists: documentos.has(ruta), data: () => documentos.get(ruta) }),
  });

  return {
    documentos,
    collection: (nombre) => ({ doc: (id) => referencia(`${nombre}/${id}`) }),
    batch: () => {
      const operaciones = [];
      return {
        set: (ref, datos) => operaciones.push(() => documentos.set(ref.ruta, datos)),
        update: (ref, cambios) =>
          operaciones.push(() => {
            const actual = structuredClone(documentos.get(ref.ruta));
            Object.entries(cambios).forEach(([campo, valor]) => {
              const [raiz, hoja] = campo.split('.');
              if (hoja) {
                actual[raiz][hoja] = valor?.incremento
                  ? Number(actual[raiz][hoja] || 0) + valor.incremento
                  : valor;
              } else actual[campo] = valor;
            });
            documentos.set(ref.ruta, actual);
          }),
        commit: async () => operaciones.forEach((operacion) => operacion()),
      };
    },
  };
};
const FieldValue = { increment: (incremento) => ({ incremento }) };

test('la primera vez abre la conversacion con un no leido; repetir el dia no suma nada', async () => {
  const db = crearBaseDeDatos();
  const [envio] = repartoDe([{ miembro: ANA, dias: 7 }]);
  const mensajes = envio.mensajes.filter((mensaje) => mensaje.idMiembros === 367);
  const ahora = '2026-09-18T11:00:00.000Z';

  const primera = await escribirMensajesDeSistema({ db, FieldValue, mensajes, ahora });
  const segunda = await escribirMensajesDeSistema({ db, FieldValue, mensajes, ahora });
  const conversacion = db.documentos.get('conversaciones_chat/individual_367_20003');

  assert.deepEqual(primera.enviados, ['367:sistema_cumpleanos_2026-09-18']);
  assert.deepEqual(segunda.enviados, []);
  assert.deepEqual(conversacion.participantesIds, [367, 20003]);
  assert.equal(conversacion.creadoPorIdMiembros, 20003);
  assert.deepEqual(conversacion.noLeidosPorIdMiembros, { 367: 1, 20003: 0 });
  assert.equal(
    db.documentos.get(
      'conversaciones_chat/individual_367_20003/mensajes/sistema_cumpleanos_2026-09-18'
    ).remitenteIdMiembros,
    20003
  );
});

test('en una conversacion que ya existe, suma un no leido y la saca de borradas', async () => {
  const db = crearBaseDeDatos();
  db.documentos.set('conversaciones_chat/individual_367_20003', {
    participantesIds: [367, 20003],
    noLeidosPorIdMiembros: { 367: 2, 20003: 0 },
    eliminada: true,
  });
  const [envio] = repartoDe([{ miembro: ANA, dias: 1 }]);
  const mensajes = envio.mensajes.filter((mensaje) => mensaje.idMiembros === 367);

  await escribirMensajesDeSistema({ db, FieldValue, mensajes, ahora: '2026-09-18T11:00:00Z' });

  const conversacion = db.documentos.get('conversaciones_chat/individual_367_20003');
  assert.equal(conversacion.noLeidosPorIdMiembros[367], 3);
  assert.equal(conversacion.eliminada, false);
  assert.equal(conversacion.ultimoMensaje.texto, 'Ana Gil está de cumpleaños mañana 🎉');
});

test('reenviar rehace el aviso del dia en su sitio, sin duplicarlo ni sumar dos no leidos', async () => {
  const db = crearBaseDeDatos();
  const [envio] = repartoDe([{ miembro: ANA, dias: 1 }]);
  const mensajes = envio.mensajes.filter((mensaje) => mensaje.idMiembros === 367);
  const ruta = 'conversaciones_chat/individual_367_20003';

  await escribirMensajesDeSistema({ db, FieldValue, mensajes, ahora: '2026-09-18T11:00:00Z' });
  // Lo lee: el no leido vuelve a cero.
  db.documentos.get(ruta).noLeidosPorIdMiembros[367] = 0;

  const otra = await escribirMensajesDeSistema({
    db,
    FieldValue,
    mensajes,
    ahora: '2026-09-18T21:00:00Z',
    reenviar: true,
  });
  const mensajesGuardados = [...db.documentos.keys()].filter((clave) =>
    clave.startsWith(`${ruta}/mensajes/`)
  );

  assert.deepEqual(otra.enviados, ['367:sistema_cumpleanos_2026-09-18']);
  assert.equal(mensajesGuardados.length, 1);
  assert.equal(db.documentos.get(ruta).noLeidosPorIdMiembros[367], 1);
  assert.equal(db.documentos.get(ruta).actualizadoEn, '2026-09-18T21:00:00.000Z');

  // Si aun no lo habia leido, no se le suma otro.
  await escribirMensajesDeSistema({
    db,
    FieldValue,
    mensajes,
    ahora: '2026-09-18T22:00:00Z',
    reenviar: true,
  });
  assert.equal(db.documentos.get(ruta).noLeidosPorIdMiembros[367], 1);
});

test('el mensaje lleva la foto grande, no la miniatura del circulo', () => {
  const [envio] = repartoDelChatDeCumpleanos({
    cumpleaneros: [{ miembro: RANDY, dias: 0 }],
    miembros: MIEMBROS,
    cuentasPorMiembro: CUENTAS,
    fotos: {
      367: { grande: 'https://fotos.test/grande.webp', mini: 'https://fotos.test/mini.webp' },
    },
    fechaClave: '2026-09-18',
  });

  assert.equal(envio.personas[0].fotoUrl, 'https://fotos.test/grande.webp');
});

test('corregir solo el contenido no cambia la hora ni vuelve a avisar', async () => {
  const db = crearBaseDeDatos();
  const [envio] = repartoDe([{ miembro: ANA, dias: 1 }]);
  const mensajes = envio.mensajes.filter((mensaje) => mensaje.idMiembros === 367);
  const ruta = 'conversaciones_chat/individual_367_20003';
  const rutaMensaje = `${ruta}/mensajes/sistema_cumpleanos_2026-09-18`;

  await escribirMensajesDeSistema({ db, FieldValue, mensajes, ahora: '2026-09-18T11:00:00Z' });
  db.documentos.get(ruta).noLeidosPorIdMiembros[367] = 0;
  // `update` sobre el mensaje: el Firestore de mentira lo resuelve aqui.
  const referencia = db.collection('conversaciones_chat').doc('individual_367_20003');
  const mensajeRef = referencia.collection('mensajes').doc('sistema_cumpleanos_2026-09-18');
  mensajeRef.update = async (cambios) =>
    db.documentos.set(rutaMensaje, { ...db.documentos.get(rutaMensaje), ...cambios });
  db.collection = () => ({
    doc: () => ({ ...referencia, collection: () => ({ doc: () => mensajeRef }) }),
  });

  const corregidos = await escribirMensajesDeSistema({
    db,
    FieldValue,
    mensajes: [{ ...mensajes[0], texto: 'Texto corregido' }],
    ahora: '2026-09-18T23:00:00Z',
    soloContenido: true,
  });

  assert.deepEqual(corregidos.enviados, ['367:sistema_cumpleanos_2026-09-18']);
  assert.equal(db.documentos.get(rutaMensaje).texto, 'Texto corregido');
  assert.equal(db.documentos.get(rutaMensaje).enviadoEn, '2026-09-18T11:00:00.000Z');
  assert.equal(db.documentos.get(ruta).noLeidosPorIdMiembros[367], 0);
});

test('el registro cuenta solo lo que salio y dice por que, a quienes y donde', () => {
  const [envio] = repartoDe([{ miembro: RANDY, dias: 0 }]);
  const registro = registroDelEnvio({
    envio,
    enviados: ['10:sistema_cumpleanos_2026-09-18', '367:sistema_felicitacion_2026-09-18'],
    fecha: new Date('2026-09-18T11:00:00Z'),
    fechaClave: '2026-09-18',
  });

  assert.equal(registro.id, '2026-09-18_cumpleanos_231');
  assert.equal(registro.tipo, 'cumpleanos');
  assert.equal(registro.motivo, 'Cumpleaños: Randy Samuel Cruz Martinez (hoy)');
  assert.equal(registro.cantidadMensajes, 2);
  assert.equal(registro.nombreDestacamento, 'Tribu de Judá');
  assert.deepEqual(
    registro.destinatarios.map(({ idMiembros, felicitacion }) => [idMiembros, felicitacion]),
    [
      [367, true],
      [10, false],
    ]
  );

  // Una prueba no pisa la entrada del envio programado del mismo dia.
  const prueba = registroDelEnvio({
    envio,
    enviados: [],
    fecha: new Date('2026-09-18T15:00:00Z'),
    fechaClave: '2026-09-18',
    origen: 'prueba',
  });
  assert.notEqual(prueba.id, registro.id);
  assert.equal(prueba.origen, 'prueba');
});
