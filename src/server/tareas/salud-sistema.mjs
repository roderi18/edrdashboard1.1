import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

import { revisarSaludDelSistema } from '../salud-sistema/chequeos.mjs';
import {
  avisarDeLaSalud,
  leerAdministradoresGlobales,
  escribirEnGrupoDeAdministradores,
} from '../salud-sistema/avisos.mjs';
import {
  COLECCION_SALUD,
  fechaClaveSalud,
  estadoGeneralSalud,
  textoResumenDiarioSalud,
  COLECCION_REVISIONES_SALUD,
} from '../../utils/salud-sistema.mjs';

// ----------------------------------------------------------------------
// LA REVISIÓN DE SALUD EN SEGUNDO PLANO (Cloud Scheduler, ver
// `src/utils/tareas-programadas.mjs`).
//
//  - `cada-hora`: revisa todo y solo avisa si algo falla o avisa.
//  - `diaria` (4:00 p. m.): lo mismo y, además, el resumen corto en el chat de
//    Administradores Globales.
//
// Cada revisión queda en `salud_sistema/ultima` y en `salud_sistema_revisiones`.
// ----------------------------------------------------------------------

// Mismo arranque que las otras tareas: así se puede probar fuera de Next, donde
// `src/server/firebase-admin` (con `import 'server-only'`) revienta.
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

// Lo que se guarda de cada chequeo (sin los campos internos).
const paraGuardar = ({ id, area, name, status, value, detail, resumen }) => ({
  id,
  area,
  name,
  status,
  value: value ?? '',
  detail,
  resumen: resumen || '',
});

/**
 * Revisa, guarda, avisa y —en la diaria— manda el resumen. Devuelve lo hecho.
 * `conexiones` y `ahora` se pueden pasar desde la prueba a mano.
 */
export async function ejecutarRevisionDeSalud({
  modo = 'cada-hora',
  conexiones = conexion(),
  ahora = new Date(),
} = {}) {
  if (!conexiones) throw new Error('Falta FIREBASE_SERVICE_ACCOUNT.');

  const { db, auth, bucket } = conexiones;
  const chequeos = await revisarSaludDelSistema({ db, auth, bucket, ahora });
  const general = estadoGeneralSalud(chequeos);
  const administradores = await leerAdministradoresGlobales(db);
  const registro = {
    fecha: ahora.toISOString(),
    fechaClave: fechaClaveSalud(ahora),
    modo,
    estado: general.status,
    criticos: general.criticos,
    advertencias: general.advertencias,
    chequeos: chequeos.map(paraGuardar),
  };

  await Promise.all([
    db.collection(COLECCION_SALUD).doc('ultima').set(registro),
    db
      .collection(COLECCION_REVISIONES_SALUD)
      .doc(ahora.toISOString().replace(/[:.]/g, '-'))
      .set(registro),
  ]);

  const avisos = await avisarDeLaSalud({
    db,
    FieldValue,
    chequeos,
    origen: 'revision_automatica',
    ahora,
    administradores,
  });
  let resumen = false;

  if (modo === 'diaria' && administradores.length) {
    const resultado = await escribirEnGrupoDeAdministradores({
      db,
      administradores,
      texto: textoResumenDiarioSalud({ chequeos, fecha: ahora }),
      // Uno por día: si Cloud Scheduler reintenta, no sale dos veces.
      idMensaje: `salud_resumen_${registro.fechaClave}`,
      metadatos: { saludSistema: { tipo: 'resumen', estado: general.status } },
      ahora: ahora.toISOString(),
    });

    resumen = resultado.enviado;
  }

  return {
    modo,
    estado: general.status,
    criticos: general.criticos,
    advertencias: general.advertencias,
    avisosNuevos: avisos.nuevos.map((c) => c.id),
    falloAlChat: avisos.chat,
    resumenAlChat: resumen,
    administradores: administradores.length,
  };
}

/** Para las rutas: nunca revienta sin decir por qué. */
export async function responderRevisionDeSalud(modo) {
  try {
    return Response.json({ ok: true, ...(await ejecutarRevisionDeSalud({ modo })) });
  } catch (error) {
    console.error(`[salud-sistema:${modo}]`, error);
    return Response.json({ ok: false, error: error?.message || 'Error' }, { status: 500 });
  }
}
