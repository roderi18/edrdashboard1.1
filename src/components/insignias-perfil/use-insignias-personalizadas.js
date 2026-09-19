'use client';

import { useSyncExternalStore } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';

import { registrarCintasPersonalizadas } from 'src/utils/cintas-perfil.mjs';
import {
  separarInsignias,
  COLECCION_INSIGNIAS_PERSONALIZADAS,
} from 'src/utils/insignias-personalizadas.mjs';

import { FIRESTORE, isFirebaseConfigured } from 'src/lib/firebase';

// ----------------------------------------------------------------------
// LAS CINTAS Y MEDALLAS AÑADIDAS EN EXPLORA DESIGNER, UNA SOLA ESCUCHA POR PÁGINA.
//
// Como el orden global (`use-orden-de-cintas.js`): una lista de miembros pinta
// muchas tarjetas y cada una abriría su escucha. Aquí hay una sola, que se abre
// con el primero que la pide y se cierra con el último. Una cinta añadida en el
// Designer aparece en vivo en los perfiles y en el diálogo para asignarla.
//
// Las cintas se registran en `cintas-perfil.mjs` ANTES de avisar a nadie: así,
// cuando el componente se vuelve a pintar, `obtenerCintaPerfil` ya las conoce.
// ----------------------------------------------------------------------

const VACIO = Object.freeze({ cintas: [], medallas: [], pines: [] });

let estado = VACIO;
let cancelar = null;
const oyentes = new Set();

const suscribir = (oyente) => {
  oyentes.add(oyente);

  if (!cancelar && isFirebaseConfigured && FIRESTORE) {
    cancelar = onSnapshot(
      collection(FIRESTORE, COLECCION_INSIGNIAS_PERSONALIZADAS),
      (instantanea) => {
        estado = separarInsignias(
          instantanea.docs.map((fila) => ({ id: fila.id, ...fila.data() }))
        );
        registrarCintasPersonalizadas(estado.cintas);
        oyentes.forEach((avisar) => avisar());
      },
      (error) => {
        // Sin permiso o sin red quedan las de fábrica: nunca un hueco.
        console.error('[insignias] no se pudieron leer las añadidas en el Designer', error);
      }
    );
  }

  return () => {
    oyentes.delete(oyente);

    if (!oyentes.size && cancelar) {
      cancelar();
      cancelar = null;
    }
  };
};

const leer = () => estado;
const leerEnServidor = () => VACIO;

/** `{ cintas, medallas, pines }` añadidos en el Designer, en vivo. */
export const useInsigniasPersonalizadas = () =>
  useSyncExternalStore(suscribir, leer, leerEnServidor);
