import { getFirestore } from 'firebase-admin/firestore';
import { cert, getApps, initializeApp } from 'firebase-admin/app';

import {
  DIAS_DE_AVISO,
  idDelMiembro,
  aceptaElAviso,
  cumpleanosDelDia,
  COLECCION_PREFERENCIAS,
  COLECCION_NOTIFICACIONES,
  destacamentoDelMiembro,
  construirAvisoDeCumpleanos,
  destinatariosDelDestacamento,
} from '../../src/server/cumpleanos-core.mjs';

// ----------------------------------------------------------------------
// EL BARRIDO DIARIO DE CUMPLEAÑOS.
//
// Corre una vez al dia y avisa a TODOS los miembros del destacamento de quien
// cumple hoy y de quien cumple dentro de siete dias.
//
// Por que una funcion programada y no la ruta `/api/notifications/birthdays`
// que ya existia: esa ruta escribe con el SDK de cliente y sin sesion, asi que
// sus escrituras morian en las reglas de Firestore. Nunca pudo funcionar, y
// nadie la llamaba. Aqui se escribe con el Admin SDK, que es lo unico que puede
// crear notificaciones a nombre del sistema.
//
// La hora: 11:00 UTC son las 07:00 en Republica Dominicana (UTC-4). Se avisa a
// primera hora, que es cuando sirve.
// ----------------------------------------------------------------------

export const config = {
  schedule: '0 11 * * *',
};

// El Admin SDK se inicializa AQUI y no se reutiliza `src/server/firebase-admin`:
// ese modulo empieza con `import 'server-only'`, que existe para reventar si
// alguien lo carga fuera de un componente de servidor de Next —y una funcion de
// Netlify lo esta—.
// La clave del service account suele viajar con los saltos de linea
// escapados (\n literal). Firebase la necesita con saltos de verdad.
const clavePrivada = (cuenta = {}) =>
  String(cuenta.private_key ?? cuenta.privateKey ?? '').split('\\n').join('\n');

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
        privateKey: clavePrivada(cuenta),
      }),
    });

  return getFirestore(app);
};

const COLECCION_ACCESOS = 'usuarios_roles';
const COLECCION_FOTOS = 'fotos';
const MIEMBROS_UPSTREAM = 'https://systexploradores.somee.com/api/Miembros/GetAllMiembros';

const filas = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.Data)) return payload.Data;
  if (Array.isArray(payload?.items)) return payload.items;

  return [];
};

const leerMiembros = async () => {
  const respuesta = await fetch(MIEMBROS_UPSTREAM, { headers: { Accept: 'application/json' } });

  if (!respuesta.ok) {
    throw new Error(`El padron no respondio (${respuesta.status}).`);
  }

  return filas(await respuesta.json());
};

/** El id de miembro -> los ids de acceso de sus cuentas. */
const leerCuentasPorMiembro = async (db) => {
  const snapshot = await db.collection(COLECCION_ACCESOS).get();
  const cuentas = {};

  snapshot.forEach((documento) => {
    const datos = documento.data() ?? {};
    const idMiembros = String(datos.idMiembros ?? '').trim();

    if (!idMiembros) return;

    const idUsuario = String(datos.uid ?? datos.uidUsuario ?? documento.id ?? '').trim();

    if (!idUsuario) return;

    cuentas[idMiembros] = [...new Set([...(cuentas[idMiembros] ?? []), idUsuario])];
  });

  return cuentas;
};

/**
 * La foto de perfil de cada miembro.
 *
 * No viene en el padron de la API: vive en Firebase, en `fotos`, con el tipo de
 * entidad y el estado que la aplicacion usa para elegir la principal. Sin esto
 * el aviso de cumpleaños sale con un icono generico en vez de con su cara.
 */
const leerFotosDeMiembros = async (db) => {
  const snapshot = await db
    .collection(COLECCION_FOTOS)
    .where('tipoEntidad', '==', 'miembro')
    .get()
    .catch(() => null);

  const fotos = {};

  snapshot?.forEach((documento) => {
    const datos = documento.data() ?? {};

    if (datos.tipoFoto !== 'perfil' || datos.estado !== 'activo') return;

    const idEntidad = String(datos.idEntidad ?? '').trim();

    if (!idEntidad || !datos.urlFoto) return;

    fotos[idEntidad] = {
      grande: String(datos.urlFoto),
      mini: String(datos.urlFotoMiniatura || ''),
    };
  });

  return fotos;
};

/** Quien apago los cumpleaños en sus preferencias se queda fuera. */
const quitarALosQueNoQuieren = async (db, idsDestinatarios, tipoNotificacion) => {
  const preferencias = await Promise.all(
    idsDestinatarios.map(async (idUsuario) => {
      const documento = await db
        .collection(COLECCION_PREFERENCIAS)
        .doc(String(idUsuario))
        .get()
        .catch(() => null);

      return { idUsuario, datos: documento?.exists ? documento.data() : null };
    })
  );

  return preferencias
    .filter(({ datos }) => aceptaElAviso(datos, tipoNotificacion))
    .map(({ idUsuario }) => idUsuario);
};

export default async function handler() {
  const db = conexion();

  if (!db) {
    console.warn('[cumpleanos] sin FIREBASE_SERVICE_ACCOUNT: no se puede avisar de nada');

    return new Response('Sin credenciales de administrador.', { status: 503 });
  }

  try {
    const [miembros, cuentasPorMiembro, fotos] = await Promise.all([
      leerMiembros(),
      leerCuentasPorMiembro(db),
      leerFotosDeMiembros(db),
    ]);

    const hoy = new Date();
    const cumpleaneros = cumpleanosDelDia(miembros, { hoy, diasAviso: DIAS_DE_AVISO });
    let enviados = 0;

    for (const { miembro, dias } of cumpleaneros) {
      const idDestacamento = destacamentoDelMiembro(miembro);
      const delDestacamento = destinatariosDelDestacamento({
        idDestacamento,
        miembros,
        cuentasPorMiembro,
        // El cumpleañero no se entera por una notificacion de su propio
        // cumpleaños: ya lo sabe, y felicitarse a si mismo no esta permitido.
        exceptoMiembro: idDelMiembro(miembro),
      });

      if (!delDestacamento.length) continue;

      const aviso = construirAvisoDeCumpleanos({
        miembro,
        dias,
        idsDestinatarios: [],
        hoy,
        urlFoto: fotos[idDelMiembro(miembro)]?.grande ?? '',
        urlFotoMiniatura: fotos[idDelMiembro(miembro)]?.mini ?? '',
      });
      const destinatarios = await quitarALosQueNoQuieren(
        db,
        delDestacamento,
        aviso.tipoNotificacion
      );

      if (!destinatarios.length) continue;

      // `merge` y no `set` a secas: si la tarea corre dos veces el mismo dia, la
      // segunda pasada no borra a quien ya lo marco como leido.
      await db
        .collection(COLECCION_NOTIFICACIONES)
        .doc(aviso.id)
        .set({ ...aviso, idsDestinatarios: destinatarios }, { merge: true });

      enviados += 1;
    }

    const resumen = `${enviados} aviso(s) de cumpleaños de ${cumpleaneros.length} cumpleañero(s).`;

    console.info(`[cumpleanos] ${resumen}`);

    return new Response(resumen, { status: 200 });
  } catch (error) {
    // Un fallo se registra y se devuelve: Netlify marca la ejecucion como
    // fallida y queda en su historial, que es donde se mira.
    console.error('[cumpleanos] no se pudo completar el barrido', error);

    return new Response(`No se pudo completar el barrido: ${error?.message}`, { status: 500 });
  }
}

// NOTA: la ruta `/api/notifications/birthdays` se retira con este cambio. Hacia
// lo mismo, pero escribia con el SDK de CLIENTE y sin sesion, asi que sus
// escrituras morian en las reglas de Firestore: nunca pudo mandar un aviso.
// Ademas no la llamaba nadie —ni cron, ni pantalla, ni script—, que es la razon
// de que el fallo no se notara nunca.
