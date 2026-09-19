'use client';

import { useSyncExternalStore } from 'react';
import { onSnapshot } from 'firebase/firestore';

import { isFirebaseConfigured } from 'src/lib/firebase';
import { referenciaDeOrdenDePines } from 'src/services/pines-miembros-apply';
import { referenciaDeOrdenDeCintas } from 'src/services/cintas-miembros-apply';
import { referenciaDeOrdenDeMedallas } from 'src/services/medallas-miembros-apply';

// ----------------------------------------------------------------------
// EL ORDEN GLOBAL DE CINTAS, MEDALLAS Y PINES, UNA SOLA ESCUCHA POR PÁGINA.
//
// Una lista de miembros pinta muchas tarjetas con cintas, y cada una abría su
// propia escucha al mismo documento. Aquí hay una sola por documento, que se abre
// con el primero que la pide y se cierra con el último. Un cambio de orden en el
// Designer llega en vivo a los perfiles abiertos.
//
// `null` mientras no hay orden guardado (o no se pudo leer): entonces manda el
// número del archivo, como siempre.
// ----------------------------------------------------------------------

const crearEscuchaDeOrden = (referencia, etiqueta) => {
  let orden = null;
  let cancelar = null;
  const oyentes = new Set();

  const suscribir = (oyente) => {
    oyentes.add(oyente);

    if (!cancelar && isFirebaseConfigured) {
      cancelar = onSnapshot(
        referencia(),
        (instantanea) => {
          const guardado = instantanea.data()?.orden;

          orden = Array.isArray(guardado) && guardado.length ? guardado : null;
          oyentes.forEach((avisar) => avisar());
        },
        (error) => {
          // Sin permiso o sin red se queda el orden de fábrica: nunca un hueco.
          console.error(`[${etiqueta}] no se pudo leer el orden global`, error);
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

  const leer = () => orden;
  const leerEnServidor = () => null;

  return () => useSyncExternalStore(suscribir, leer, leerEnServidor);
};

export const useOrdenDeCintas = crearEscuchaDeOrden(referenciaDeOrdenDeCintas, 'cintas');

export const useOrdenDeMedallas = crearEscuchaDeOrden(referenciaDeOrdenDeMedallas, 'medallas');

export const useOrdenDePines = crearEscuchaDeOrden(referenciaDeOrdenDePines, 'pines');
