import { FieldValue } from 'firebase-admin/firestore';

import { COLECCIONES } from '../../config/esquema-firestore.mjs';
import {
  tasaTrasLectura,
  tasaDeFilasBcrd,
  hoyEnSantoDomingo,
  COLECCION_MEMBRESIA,
  FUENTE_TASA_RESPALDO,
  FUENTE_TASA_AUTOMATICA,
  DIAS_CON_TASA_ANTERIOR,
  DOC_CONFIGURACION_MEMBRESIA,
  sanearConfiguracionMembresia,
} from '../../utils/membresia-onerrd.mjs';

// ----------------------------------------------------------------------
// CADA DÍA A LAS 6:00 a. m. (Santo Domingo): LA TASA DEL DÓLAR DE LA MEMBRESÍA.
//
// PayPal no cobra en pesos ni publica su tasa, así que la landing cobra en
// dólares con la de `configuracionMembresia2027/general.tasa`. Antes había que
// escribirla a mano cada día o PayPal se apagaba. Con "Tasa automática"
// encendida, esta tarea lee la del Banco Central (con un respaldo si no
// responde), le resta el margen, la guarda y avisa a la campana de
// Administradores Globales, Oficina Nacional y Administrador de Tienda con la
// tasa aplicada. Si la lectura falla, sigue la de ayer (hasta tres días) y lo
// avisa: nunca queda vacía.
//
// La lanza Cloud Scheduler contra `/api/tareas/tasa-dolar-membresia`; el botón
// "Actualizar ahora" del panel la lanza a mano. La regla está en
// `src/utils/membresia-onerrd.mjs` (`tasaTrasLectura`).
// ----------------------------------------------------------------------

// A quién avisa la campana: también al Administrador de Tienda, que cobra en
// la tienda con PayPal.
const ROLES_DESTINO = ['administrador_global', 'oficina_nacional', 'administrador_tienda'];
const SISTEMA = { idMiembros: 20003, nombre: 'Sistema' };

const pedir = (url) =>
  fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(15_000) }).then((r) => {
    if (!r.ok) throw new Error(`respondió ${r.status}`);
    return r;
  });

async function leerBcrd() {
  const { read, utils } = await import('xlsx');
  const libro = read(await (await pedir(FUENTE_TASA_AUTOMATICA.url)).arrayBuffer(), {
    type: 'array',
    sheets: 'Diaria',
  });
  const hoja = libro.Sheets.Diaria;
  if (!hoja) throw new Error('el archivo ya no trae la hoja "Diaria"');
  const tasa = tasaDeFilasBcrd(utils.sheet_to_json(hoja, { header: 1, raw: true }));
  if (!tasa) throw new Error('no se encontró la tasa en el archivo');
  return {
    valor: tasa.compra,
    fuente: `BCRD, compra del ${tasa.fecha.split('-').reverse().join('/')}`,
  };
}

async function leerRespaldo() {
  const datos = await (await pedir(FUENTE_TASA_RESPALDO.url)).json();
  const valor = Number(datos?.rates?.DOP);
  if (datos?.result !== 'success' || !Number.isFinite(valor)) {
    throw new Error('no trajo la tasa del peso dominicano');
  }
  return { valor, fuente: FUENTE_TASA_RESPALDO.nombre };
}

// Primero el BCRD; si falla, el respaldo. Solo es fallo si fallan los dos.
export async function leerTasaDeInternet() {
  let errorBcrd;
  try {
    return await leerBcrd();
  } catch (error) {
    errorBcrd = error?.message || 'error';
  }
  try {
    return await leerRespaldo();
  } catch (error) {
    return { error: `BCRD: ${errorBcrd}; respaldo: ${error?.message || 'error'}.` };
  }
}

async function uidsDestinatarios(db) {
  const roles = db.collection(COLECCIONES.usuariosRoles);
  const [porRol, porCargos] = await Promise.all([
    roles.where('rolId', 'in', ROLES_DESTINO).get(),
    roles.where('rolesQueEjerce', 'array-contains-any', ROLES_DESTINO).get(),
  ]);
  const uids = new Set();
  [...porRol.docs, ...porCargos.docs].forEach((d) => {
    const datos = d.data() || {};
    if (datos.activo === false) return;
    const uid = String(datos.uid || (d.id.length > 20 ? d.id : '')).trim();
    if (uid) uids.add(uid);
  });
  return [...uids];
}

async function escribirAviso(db, { id, titulo, tituloHtml, mensaje, prioridad, metadatos }, ahora) {
  const idsDestinatarios = await uidsDestinatarios(db);
  if (!idsDestinatarios.length) return;
  const fecha = ahora.toISOString();
  try {
    await db
      .collection(COLECCIONES.notificaciones)
      .doc(id)
      .create({
        id,
        tipoNotificacion: 'membresia_onerrd_tasa',
        modulo: 'certificados',
        titulo,
        tituloHtml,
        mensaje,
        mensajeVisual: mensaje,
        rolDestinatario: 'admin',
        idsDestinatarios,
        prioridad,
        estado: 'no_leida',
        creadoPorUid: null,
        fechaCreacion: fecha,
        fechaEnvio: fecha,
        actorId: String(SISTEMA.idMiembros),
        actorTipo: 'sistema',
        actorNombre: SISTEMA.nombre,
        actorFotoURL: null,
        entidadTipo: 'configuracion',
        entidadId: 'membresia-2027-tasa',
        ruta: '/dashboard/certificates?tab=onerrd',
        imagenTipo: 'icono',
        imagenURL: null,
        miniaturaURL: null,
        tipoAccion: 'ver',
        etiquetaAccion: 'Ver configuración',
        leidaPor: [],
        metadatos,
        creadoEnServidor: FieldValue.serverTimestamp(),
        actualizadoEnServidor: FieldValue.serverTimestamp(),
      });
  } catch (error) {
    // Ya avisado (ALREADY_EXISTS): no se repite.
    if (error?.code !== 6 && !/already exists/i.test(String(error?.message))) throw error;
  }
}

// Cada tasa nueva se avisa: cuál dio el BCRD (o el respaldo) y con cuál cobra
// PayPal tras el margen. Un aviso por lectura.
const avisarTasaAplicada = (db, tasa, ahora) =>
  escribirAviso(
    db,
    {
      id: `membresia-tasa-${ahora.getTime()}`,
      titulo: `Membresía 2027: tasa del dólar aplicada a PayPal, RD$${tasa.rdPorUsd}`,
      tituloHtml: `<p>Membresía 2027: tasa aplicada a PayPal, <strong>RD$${tasa.rdPorUsd} por US$1</strong></p>`,
      mensaje: `Tasa del ${tasa.fuente}: RD$${tasa.base} por US$1. Con ${tasa.margen} % de margen, PayPal cobra a RD$${tasa.rdPorUsd} por US$1.`,
      prioridad: 'normal',
      metadatos: {
        fuente: tasa.fuente,
        base: tasa.base,
        margen: tasa.margen,
        rdPorUsd: tasa.rdPorUsd,
      },
    },
    ahora
  );

// Un aviso de fallo por día (mismo id): repetir la tarea no llena la campana.
const avisarFallo = (db, tasa, ahora) => {
  const sigue = Boolean(tasa.rdPorUsd) && tasa.fallosSeguidos <= DIAS_CON_TASA_ANTERIOR;
  return escribirAviso(
    db,
    {
      id: `membresia-tasa-fallo-${hoyEnSantoDomingo(ahora)}`,
      titulo: 'Membresía 2027: falló la tasa automática del dólar',
      tituloHtml: '<p>Membresía 2027: falló la <strong>tasa automática del dólar</strong></p>',
      mensaje: sigue
        ? `No se pudo leer la tasa del dólar (${tasa.ultimoError}). Se sigue cobrando con la anterior, RD$${tasa.rdPorUsd} por US$1.`
        : `No se pudo leer la tasa del dólar (${tasa.ultimoError}) y ya no hay una vigente: PayPal queda apagado hasta que se ponga a mano.`,
      prioridad: sigue ? 'importante' : 'critica',
      metadatos: { error: tasa.ultimoError, fallosSeguidos: tasa.fallosSeguidos },
    },
    ahora
  );
};

/** Lee la tasa y la guarda. Devuelve la tasa resultante (u `omitida`). */
export async function actualizarTasaDeMembresia(db, { ahora = new Date() } = {}) {
  const referencia = db.collection(COLECCION_MEMBRESIA).doc(DOC_CONFIGURACION_MEMBRESIA);
  const config = sanearConfiguracionMembresia((await referencia.get()).data() || {});
  if (!config.tasa.automatica) return { omitida: true, tasa: config.tasa };

  const lectura = await leerTasaDeInternet();
  // Se relee dentro de la transacción: si alguien apagó la automática o
  // cambió el margen mientras se consultaba, manda lo de ahora.
  const tasa = await db.runTransaction(async (tx) => {
    const actual = sanearConfiguracionMembresia((await tx.get(referencia)).data() || {});
    const nueva = tasaTrasLectura(actual.tasa, lectura, ahora);
    tx.set(referencia, { tasa: nueva }, { merge: true });
    return nueva;
  });
  if (tasa.automatica) {
    await (lectura.error ? avisarFallo : avisarTasaAplicada)(db, tasa, ahora);
  }
  return { ok: !lectura.error, tasa };
}
