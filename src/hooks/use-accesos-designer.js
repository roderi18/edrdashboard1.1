'use client';

import { useSyncExternalStore } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';

import {
  reglasDeAccesos,
  REGLAS_DE_FABRICA,
  registrarAccesosDesigner,
  DOCUMENTO_ACCESOS_DESIGNER,
  COLECCION_CONFIGURACION_DESIGNER,
} from 'src/utils/accesos-designer.mjs';

import { FIRESTORE, isFirebaseConfigured } from 'src/lib/firebase';

// ----------------------------------------------------------------------
// LAS REGLAS DE "ACCESOS" DE EXPLORA DESIGNER, UNA SOLA ESCUCHA POR PÁGINA.
//
// Las piden el menú (para enseñar o no la entrada), el Designer (qué pestañas) y
// sus botones (crear, editar, eliminar). Como las insignias: una escucha que se
// abre con el primero y se cierra con el último. Antes de avisar se REGISTRAN
// (`registrarAccesosDesigner`), así que `puedeEnDesigner` —lo que preguntan los
// servicios al escribir— responde ya con lo nuevo. Un cambio en "Accesos" llega
// en vivo a quien tenga el Designer abierto.
// ----------------------------------------------------------------------

let estado = REGLAS_DE_FABRICA;
let cancelar = null;
const oyentes = new Set();

const suscribir = (oyente) => {
  oyentes.add(oyente);

  if (!cancelar && isFirebaseConfigured && FIRESTORE) {
    cancelar = onSnapshot(
      doc(FIRESTORE, COLECCION_CONFIGURACION_DESIGNER, DOCUMENTO_ACCESOS_DESIGNER),
      (instantanea) => {
        estado = reglasDeAccesos(instantanea.exists() ? instantanea.data() : null);
        registrarAccesosDesigner(estado);
        oyentes.forEach((avisar) => avisar());
      },
      (error) => {
        // Sin permiso o sin red quedan las de fábrica.
        console.error('[designer] no se pudieron leer los accesos', error);
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
const leerEnServidor = () => REGLAS_DE_FABRICA;

/** Las reglas vigentes de "Accesos", en vivo. */
export const useAccesosDesigner = () => useSyncExternalStore(suscribir, leer, leerEnServidor);
