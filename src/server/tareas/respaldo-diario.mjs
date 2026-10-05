import { gzipSync } from 'zlib';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

import { COLECCIONES } from '../../config/esquema-firestore.mjs';

import { fechaClaveSalud } from '../../utils/salud-sistema.mjs';
import {
  leerAdministradoresGlobales,
  escribirEnGrupoDeAdministradores,
} from '../salud-sistema/avisos.mjs';
import {
  carpetaDelDia,
  filasDelPadron,
  serializarValor,
  SERVICIOS_PADRON,
  CARPETA_RESPALDOS,
  textoResumenRespaldo,
  esCarpetaDiariaVencida,
  CARPETA_ESPEJO_ARCHIVOS,
} from '../../utils/respaldo-diario.mjs';

// ----------------------------------------------------------------------
// EL RESPALDO DIARIO (Cloud Scheduler, 11:00 p. m.; ver
// `src/utils/tareas-programadas.mjs` y la regla en `respaldo-diario.mjs`).
//
// Cada parte va por su cuenta: si la API .NET no responde, Firestore y los
// archivos se respaldan igual y el mensaje dice qué falló.
// ----------------------------------------------------------------------

const API = 'https://systexploradores.somee.com/api';
const TIEMPO_MAXIMO_API_MS = 60_000;

const conexion = () => {
  const credencial = process.env.FIREBASE_SERVICE_ACCOUNT;

  if (!credencial) return null;

  const cuenta = JSON.parse(credencial);
  const app =
    getApps()[0] ??
    initializeApp({
      credential: cert({
        projectId: cuenta.project_id ?? cuenta.projectId,
        clientEmail: cuenta.client_email ?? cuenta.clientEmail,
        privateKey: String(cuenta.private_key ?? cuenta.privateKey ?? '')
          .split('\\n')
          .join('\n'),
      }),
    });
  const proyecto = cuenta.project_id ?? cuenta.projectId;

  return {
    db: getFirestore(app),
    auth: getAuth(app),
    bucket: getStorage(app).bucket(
      process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || `${proyecto}.firebasestorage.app`
    ),
  };
};

/** De `limite` en `limite`: con todo a la vez, Firestore y Storage frenaban. */
const enTandas = async (lista, limite, fn) => {
  const resultados = [];

  for (let i = 0; i < lista.length; i += limite) {
    resultados.push(...(await Promise.all(lista.slice(i, i + limite).map(fn))));
  }

  return resultados;
};

/** Guarda un JSON comprimido y devuelve cuánto ocupa. Privado: solo lo lee el servidor. */
const guardarJson = async (bucket, ruta, datos) => {
  const comprimido = gzipSync(Buffer.from(JSON.stringify(datos)));

  await bucket.file(ruta).save(comprimido, {
    resumable: false,
    contentType: 'application/gzip',
    metadata: { cacheControl: 'private, max-age=0' },
  });

  return comprimido.length;
};

// ---------------------------------------------------------------- Partes

/**
 * Firestore entero: cada documento con su ruta completa, también los de las
 * subcolecciones. Lista plana `{ ruta, datos }`: para restaurar basta con
 * escribir cada uno en su ruta.
 */
async function respaldarFirestore({ db, bucket, carpeta }) {
  const documentos = [];
  let bytesLeidos = 0;

  const recorrer = async (coleccion) => {
    const instantanea = await coleccion.get();

    instantanea.docs.forEach((documento) => {
      const datos = serializarValor(documento.data());

      bytesLeidos += JSON.stringify(datos).length;
      documentos.push({ ruta: documento.ref.path, datos });
    });

    // Las subcolecciones de cada documento (mensajes del chat, historial…).
    const subcolecciones = await enTandas(instantanea.docs, 100, (d) => d.ref.listCollections());

    for (const lista of subcolecciones) {
      for (const sub of lista) await recorrer(sub);
    }
  };

  const raices = await db.listCollections();

  await enTandas(raices, 8, recorrer);

  const bytesGuardados = await guardarJson(bucket, `${carpeta}/firestore.json.gz`, {
    generado: new Date().toISOString(),
    documentos,
  });

  return { documentos: documentos.length, colecciones: raices.length, bytesLeidos, bytesGuardados };
}

async function respaldarPadron({ bucket, carpeta, fetchImpl = fetch }) {
  const datos = {};
  const servicios = await enTandas(SERVICIOS_PADRON, 2, async (servicio) => {
    const control = new AbortController();
    const reloj = setTimeout(() => control.abort(), TIEMPO_MAXIMO_API_MS);

    try {
      const respuesta = await fetchImpl(`${API}${servicio.ruta}?t=${Date.now()}`, {
        signal: control.signal,
        cache: 'no-store',
      });
      const texto = await respuesta.text();

      if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);

      datos[servicio.id] = JSON.parse(texto);

      return { ...servicio, filas: filasDelPadron(datos[servicio.id]).length, bytes: texto.length };
    } catch (error) {
      return {
        ...servicio,
        filas: 0,
        bytes: 0,
        error: error?.name === 'AbortError' ? 'sin respuesta' : error?.message,
      };
    } finally {
      clearTimeout(reloj);
    }
  });
  const fallidos = servicios.filter((s) => s.error);

  if (fallidos.length === servicios.length) throw new Error('la API .NET no respondió');

  const bytesGuardados = await guardarJson(bucket, `${carpeta}/padron.json.gz`, {
    generado: new Date().toISOString(),
    servicios: datos,
  });

  return {
    servicios,
    fallidos: fallidos.length,
    bytesLeidos: servicios.reduce((t, s) => t + s.bytes, 0),
    bytesGuardados,
  };
}

/** Las cuentas de acceso, sin contraseñas: para saber quién tenía cuenta y con qué rol. */
async function respaldarCuentas({ auth, bucket, carpeta }) {
  const cuentas = [];
  let pagina;

  do {
    const lote = await auth.listUsers(1000, pagina);

    lote.users.forEach((u) =>
      cuentas.push({
        uid: u.uid,
        email: u.email || null,
        displayName: u.displayName || null,
        phoneNumber: u.phoneNumber || null,
        disabled: u.disabled,
        emailVerified: u.emailVerified,
        customClaims: u.customClaims || null,
        proveedores: (u.providerData || []).map((p) => p.providerId),
        creada: u.metadata?.creationTime || null,
        ultimoAcceso: u.metadata?.lastSignInTime || null,
      })
    );
    pagina = lote.pageToken;
  } while (pagina);

  const bytesGuardados = await guardarJson(bucket, `${carpeta}/cuentas.json.gz`, {
    generado: new Date().toISOString(),
    cuentas,
  });

  return { total: cuentas.length, bytesGuardados };
}

/**
 * Espejo de los archivos de Storage en `respaldos/archivos/`: copia en el
 * servidor de Google (sin bajarlos) solo lo nuevo o cambiado. Lo que se borre
 * del original se queda en el espejo: para eso está.
 */
async function respaldarArchivos({ bucket }) {
  const [todos] = await bucket.getFiles({ autoPaginate: true });
  const originales = todos.filter((f) => !f.name.startsWith(`${CARPETA_RESPALDOS}/`));
  const espejo = new Map(
    todos
      .filter((f) => f.name.startsWith(`${CARPETA_ESPEJO_ARCHIVOS}/`))
      .map((f) => [f.name.slice(CARPETA_ESPEJO_ARCHIVOS.length + 1), f.metadata?.md5Hash])
  );
  const porCopiar = originales.filter(
    (f) => !f.name.endsWith('/') && espejo.get(f.name) !== f.metadata?.md5Hash
  );

  await enTandas(porCopiar, 25, (f) => f.copy(bucket.file(`${CARPETA_ESPEJO_ARCHIVOS}/${f.name}`)));

  return {
    total: originales.length,
    bytesTotal: originales.reduce((t, f) => t + Number(f.metadata?.size || 0), 0),
    copiados: porCopiar.length,
    bytesCopiados: porCopiar.reduce((t, f) => t + Number(f.metadata?.size || 0), 0),
  };
}

/** Borra las carpetas diarias de hace más de 14 días (nunca el espejo de archivos). */
async function borrarVencidos({ bucket, fechaClave }) {
  const [archivos] = await bucket.getFiles({ prefix: `${CARPETA_RESPALDOS}/`, autoPaginate: true });
  const vencidos = archivos.filter((f) => esCarpetaDiariaVencida(f.name, fechaClave));

  await enTandas(vencidos, 25, (f) => f.delete({ ignoreNotFound: true }));

  return vencidos.length;
}

// ---------------------------------------------------------------- Tarea

export async function ejecutarRespaldoDiario({ conexiones = conexion(), ahora = new Date() } = {}) {
  if (!conexiones) throw new Error('Falta FIREBASE_SERVICE_ACCOUNT.');

  const { db, auth, bucket } = conexiones;
  const inicio = Date.now();
  const fechaClave = fechaClaveSalud(ahora);
  const carpeta = carpetaDelDia(fechaClave);
  const partes = {};
  const fallos = [];

  const intentar = async (clave, nombre, fn) => {
    try {
      partes[clave] = await fn();
    } catch (error) {
      console.error(`[respaldo-diario:${clave}]`, error);
      fallos.push({ parte: nombre, mensaje: String(error?.message || error).slice(0, 200) });
    }
  };

  // Firestore y archivos en paralelo con el padrón (que espera a la API .NET).
  await Promise.all([
    intentar('firestore', 'Base de datos (Firestore)', () =>
      respaldarFirestore({ db, bucket, carpeta })
    ),
    intentar('padron', 'Padrón (API .NET)', () => respaldarPadron({ bucket, carpeta })),
    intentar('cuentas', 'Cuentas de acceso', () => respaldarCuentas({ auth, bucket, carpeta })),
    intentar('archivos', 'Archivos (Storage)', () => respaldarArchivos({ bucket })),
  ]);

  const vencidos = await borrarVencidos({ bucket, fechaClave }).catch(() => 0);
  const duracionMs = Date.now() - inicio;
  const resumen = {
    fecha: ahora.toISOString(),
    fechaClave,
    carpeta,
    duracionMs,
    completo: !fallos.length,
    fallos,
    firestore: partes.firestore || null,
    padron: partes.padron
      ? {
          ...partes.padron,
          servicios: partes.padron.servicios.map(({ id, filas, error }) => ({
            id,
            filas,
            error: error || null,
          })),
        }
      : null,
    cuentas: partes.cuentas || null,
    archivos: partes.archivos || null,
    vencidosBorrados: vencidos,
  };

  await guardarJson(bucket, `${carpeta}/resumen.json.gz`, resumen).catch(() => null);

  // El "último respaldo" que mira Salud y la pantalla de Mantenimiento. Solo si
  // la base de datos se respaldó: sin ella, no hay respaldo que valga.
  if (partes.firestore) {
    await db
      .collection(COLECCIONES.respaldosAdministracion)
      .doc('ultimo')
      .set(
        {
          fecha: ahora.toISOString(),
          archivo: `${carpeta}/firestore.json.gz`,
          origen: 'respaldo_diario_nube',
          totalColecciones: partes.firestore.colecciones,
          totalRegistros: partes.firestore.documentos,
          completo: !fallos.length,
          generadoPor: { uid: null, nombre: 'Sistema', correo: null },
          actualizadoEnServidor: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
  }

  const administradores = await leerAdministradoresGlobales(db);
  let mensaje = false;

  if (administradores.length) {
    const resultado = await escribirEnGrupoDeAdministradores({
      db,
      administradores,
      texto: textoResumenRespaldo({ partes, fallos, fecha: ahora, duracionMs, carpeta }),
      idMensaje: `respaldo_diario_${fechaClave}`,
      metadatos: { respaldoDiario: { fechaClave, completo: !fallos.length } },
      ahora: new Date().toISOString(),
    });

    mensaje = resultado.enviado;
  }

  return { ...resumen, mensajeAlChat: mensaje };
}

export async function responderRespaldoDiario() {
  try {
    const resultado = await ejecutarRespaldoDiario();

    return Response.json(
      {
        ok: resultado.completo,
        carpeta: resultado.carpeta,
        duracionMs: resultado.duracionMs,
        fallos: resultado.fallos,
        mensajeAlChat: resultado.mensajeAlChat,
      },
      { status: resultado.completo ? 200 : 503 }
    );
  } catch (error) {
    console.error('[respaldo-diario]', error);
    return Response.json({ ok: false, error: error?.message || 'Error' }, { status: 500 });
  }
}
