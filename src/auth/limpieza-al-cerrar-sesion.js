import { terminate, waitForPendingWrites, clearIndexedDbPersistence } from 'firebase/firestore';

import { borrarDatosDeSesion } from 'src/utils/storage-service';
import { invalidarLecturas } from 'src/utils/cache-de-lecturas.mjs';

import { FIRESTORE } from 'src/lib/firebase';

// ----------------------------------------------------------------------
// AL CERRAR SESIÓN NO QUEDA NADA DE LA PERSONA EN EL EQUIPO.
//
// Qué se rompía: cerrar sesión solo cerraba la cuenta. En el disco seguían el
// padrón (teléfonos, direcciones, fechas de nacimiento), las respuestas de la
// API que el service worker guarda para pasar lista sin señal y la caché de
// Firestore (salud, tutores, directivas…). Quien abriera después el navegador
// de un teléfono compartido o perdido podía leerlo.
//
// Tres pasos, en este orden:
//   1. `antesDeCerrar`: se espera (con tope) a que Firestore suba lo que tenga
//      pendiente —un pase de lista hecho sin señal—. Si no da tiempo, esa caché
//      NO se borra: perder una asistencia sería peor.
//   2. `despuesDeCerrar`: fuera la caché de lecturas, el padrón de la sesión y
//      las copias del service worker.
//   3. Si no quedaba nada pendiente, se cierra Firestore y se borra su caché en
//      disco. Firestore queda inservible hasta recargar, así que el llamador
//      recarga la página (`necesitaRecargar`).
// ----------------------------------------------------------------------

const TOPE_DE_ESPERA_MS = 3000;

// Las cachés del service worker con datos de personas (no la de estáticos).
const esCacheConDatos = (nombre) => nombre.endsWith('-datos') || nombre.endsWith('-paginas');

export async function antesDeCerrar() {
  if (!FIRESTORE) return { sinPendientes: false };

  const tope = new Promise((resolver) => {
    setTimeout(() => resolver('tope'), TOPE_DE_ESPERA_MS);
  });

  const resultado = await Promise.race([
    waitForPendingWrites(FIRESTORE).then(() => 'subido'),
    tope,
  ]).catch(() => 'tope');

  return { sinPendientes: resultado === 'subido' };
}

export async function despuesDeCerrar({ sinPendientes }) {
  invalidarLecturas();
  borrarDatosDeSesion();

  if (typeof caches !== 'undefined') {
    try {
      const nombres = await caches.keys();
      await Promise.all(nombres.filter(esCacheConDatos).map((nombre) => caches.delete(nombre)));
    } catch (error) {
      console.warn('[sesion] no se pudieron borrar las copias del service worker', error);
    }
  }

  if (!sinPendientes || !FIRESTORE) {
    if (!sinPendientes) {
      console.warn('[sesion] quedaban escrituras sin subir: la caché de Firestore se conserva');
    }

    return { necesitaRecargar: false };
  }

  try {
    await terminate(FIRESTORE);
    // Falla si otra pestaña de la aplicación sigue abierta: entonces se queda
    // hasta que se cierre la última (y `sessionStorage` ya se vació).
    await clearIndexedDbPersistence(FIRESTORE).catch((error) => {
      console.warn('[sesion] la caché de Firestore sigue en uso por otra pestaña', error);
    });
  } catch (error) {
    console.warn('[sesion] no se pudo cerrar Firestore', error);
  }

  return { necesitaRecargar: true };
}
