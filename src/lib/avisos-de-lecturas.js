'use client';

import { useState, useEffect } from 'react';
import { doc, setDoc, increment, onSnapshot, serverTimestamp } from 'firebase/firestore';

import { invalidarLecturas, registrarAvisador } from 'src/utils/cache-de-lecturas.mjs';

import { FIRESTORE, isFirebaseConfigured } from 'src/lib/firebase';

// ----------------------------------------------------------------------
// ACTUALIZACIONES EN VIVO ENTRE SESIONES.
//
// Qué se rompía: la caché de lecturas se vaciaba al escribir, pero solo en la
// sesión que escribía. Si la Oficina Nacional asignaba un cargo, el Director lo
// veía en su próxima visita a la pantalla, no en el momento.
//
// Cómo funciona: un solo documento (`versiones_lecturas/general`) con un
// contador por tipo de dato ("regiones", "directiva", "tienda-productos"…).
//   - Quien escribe suma uno a lo que tocó. Los avisos se juntan 1,5 s y salen
//     en una sola escritura: el documento no se satura aunque haya ráfagas.
//   - Cada sesión escucha el documento. Cuando un contador sube, olvida ese tipo
//     de dato y avisa a las pantallas abiertas (`useLecturasVivas`), que se
//     releen solas.
//   - Los ecos de la propia escritura (con `hasPendingWrites`) no cuentan: esa
//     sesión ya vació su caché al escribir.
//
// Si el documento no se puede leer (reglas sin publicar, sin red), no pasa nada:
// cada pantalla se sigue poniendo al día al visitarla, como antes.
// ----------------------------------------------------------------------

const COLECCION = 'versiones_lecturas';
const DOCUMENTO = 'general';
const ESPERA_PARA_JUNTAR_MS = 1500;
const EVENTO = 'edr-lecturas-cambiadas';

// Lo que es de una sola persona no se avisa: a nadie más le cambia nada.
const NO_SE_AVISA = ['carrito:', 'direcciones:', 'avisos-config:', 'everest-analiticas:'];

// Los nombres de campo de Firestore no llevan ":"; se codifican y se deshacen.
const aCampo = (prefijo) => prefijo.replace(/:/g, '__');
const aPrefijo = (campo) => campo.replace(/__/g, ':');

const referencia = () => doc(FIRESTORE, COLECCION, DOCUMENTO);

let pendientes = new Set();
let temporizador = null;

const enviarPendientes = () => {
  temporizador = null;

  if (!pendientes.size || !FIRESTORE) return;

  const datos = { actualizadoEn: serverTimestamp() };

  pendientes.forEach((prefijo) => {
    datos[aCampo(prefijo)] = increment(1);
  });
  pendientes = new Set();

  setDoc(referencia(), datos, { merge: true }).catch((error) => {
    console.warn('[avisos-de-lecturas] no se pudo avisar del cambio', error);
  });
};

const avisar = (prefijos) => {
  prefijos
    .filter((prefijo) => !NO_SE_AVISA.some((propio) => prefijo.startsWith(propio)))
    .forEach((prefijo) => pendientes.add(prefijo));

  if (pendientes.size && !temporizador) {
    temporizador = setTimeout(enviarPendientes, ESPERA_PARA_JUNTAR_MS);
  }
};

/** Empieza a avisar y a escuchar. Devuelve la función que lo detiene. */
export function iniciarAvisosDeLecturas() {
  if (!isFirebaseConfigured || !FIRESTORE || typeof window === 'undefined') {
    return () => {};
  }

  registrarAvisador(avisar);

  let vistos = null;

  const detener = onSnapshot(
    referencia(),
    { includeMetadataChanges: false },
    (instantanea) => {
      const datos = instantanea.data() || {};
      const contadores = Object.fromEntries(
        Object.entries(datos).filter(([, valor]) => typeof valor === 'number')
      );

      // La primera lectura solo fija el punto de partida.
      if (vistos === null || instantanea.metadata.hasPendingWrites) {
        vistos = contadores;
        return;
      }

      const cambiados = Object.keys(contadores)
        .filter((campo) => contadores[campo] !== vistos[campo])
        .map(aPrefijo);

      vistos = contadores;

      if (!cambiados.length) return;

      invalidarLecturas(...cambiados);
      window.dispatchEvent(new CustomEvent(EVENTO, { detail: { prefijos: cambiados } }));
    },
    (error) => {
      console.warn('[avisos-de-lecturas] sin avisos en vivo', error);
    }
  );

  return () => {
    detener();
    registrarAvisador(null);
  };
}

/**
 * Un número que sube cada vez que otra sesión cambia algo de `prefijos`. Se pone
 * en las dependencias del efecto que carga la pantalla: al subir, se relee
 * (desde la red, porque la caché de ese tipo ya se vació).
 */
export function useLecturasVivas(prefijos) {
  const [version, setVersion] = useState(0);
  const clave = prefijos.join('|');

  useEffect(() => {
    const lista = clave.split('|').filter(Boolean);

    const alCambiar = (evento) => {
      const tocados = evento.detail?.prefijos || [];

      if (tocados.some((tocado) => lista.some((prefijo) => tocado.startsWith(prefijo) || prefijo.startsWith(tocado)))) {
        setVersion((actual) => actual + 1);
      }
    };

    window.addEventListener(EVENTO, alCambiar);

    return () => window.removeEventListener(EVENTO, alCambiar);
  }, [clave]);

  return version;
}
