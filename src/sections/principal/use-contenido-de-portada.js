import { useState, useEffect, useLayoutEffect } from 'react';

import { resolverPortada } from 'src/utils/everest/portada.mjs';
import { PANTALLAS_EVEREST } from 'src/utils/everest/colecciones.mjs';

import { obtenerPublicado } from 'src/services/everest-service';

import { FABRICA_DE_PORTADA } from './fabrica-de-portada';

// ----------------------------------------------------------------------
// LO QUE SE PINTA EN CADA BLOQUE DE LA PORTADA.
//
// La portada ya no importa sus datos a mano: se los pide a este gancho, que
// devuelve para cada bloque lo publicado en EVEREST Designer o, si no hay nada
// —o lo publicado esta roto—, exactamente lo de siempre (`FABRICA_DE_PORTADA`).
// La decision la toma `resolverPortada`, que esta probada aparte.
//
// POR QUE ARRANCA SIEMPRE CON LO DE FABRICA. El primer pintado —en el servidor y
// en el navegador— tiene que ser identico, o React se queja de que no casan. Asi
// que se empieza por lo de siempre y lo publicado llega despues. Mientras nadie
// publique nada, ese "despues" no cambia nada: no hay documento, no hay copia, y
// la portada se queda como estaba.
//
// POR QUE HAY UNA COPIA EN EL NAVEGADOR. Cuando SI hay algo publicado, leer
// Firestore tarda unas decimas, y la portada enseñaria un instante lo de fabrica
// antes de cambiar a lo publicado: un parpadeo con los datos viejos. Se guarda lo
// ultimo leido y se aplica ANTES de pintar (`useLayoutEffect`). La copia pasa por
// el mismo saneado que Firestore: tocarla a mano no cuela nada.
//
// UNA LECTURA POR VISITA, no una escucha en vivo: la portada no tiene por que
// redibujarse mientras alguien la esta leyendo porque otro publico algo.
// ----------------------------------------------------------------------

const PANTALLA = PANTALLAS_EVEREST.principal;

export const CLAVE_COPIA_DE_PORTADA = 'erd-everest-portada-publicada';

// En el servidor no hay pintado que adelantar, y `useLayoutEffect` avisa.
const useEfectoAntesDePintar = typeof window === 'undefined' ? useEffect : useLayoutEffect;

const resolver = (publicado) =>
  resolverPortada({ publicado, fabrica: FABRICA_DE_PORTADA, pantalla: PANTALLA });

const leerCopia = () => {
  try {
    return JSON.parse(window.localStorage.getItem(CLAVE_COPIA_DE_PORTADA) ?? 'null');
  } catch {
    return null;
  }
};

const guardarCopia = (publicado) => {
  try {
    if (publicado) {
      window.localStorage.setItem(CLAVE_COPIA_DE_PORTADA, JSON.stringify(publicado));
    } else {
      // Sin publicacion no se guarda nada: la siguiente visita arranca con lo de
      // siempre, que es lo que hay.
      window.localStorage.removeItem(CLAVE_COPIA_DE_PORTADA);
    }
  } catch {
    // Ventana privada o almacenamiento lleno: se pierde el adelanto, no la portada.
  }
};

/**
 * `{ idBloque: { origen, contenido, publicadoEn?, publicadoPor? } }` para cada
 * bloque de la portada. `contenido` es lo que recibe su componente.
 */
export function useContenidoDePortada() {
  const [portada, setPortada] = useState(() => resolver(null));

  useEfectoAntesDePintar(() => {
    const copia = leerCopia();

    if (copia) setPortada(resolver(copia));
  }, []);

  useEffect(() => {
    let vigente = true;

    obtenerPublicado(PANTALLA, { lanzarSiFalla: true })
      .then((publicado) => {
        if (!vigente) return;

        guardarCopia(publicado);
        setPortada(resolver(publicado));
      })
      .catch(() => {
        // NO SE PUDO LEER no es lo mismo que NO HAY NADA PUBLICADO. Sin red, o con
        // las reglas aun sin publicar, se queda lo que ya se estaba pintando —la
        // copia, o lo de fabrica— y no se borra la copia buena.
      });

    return () => {
      vigente = false;
    };
  }, []);

  return portada;
}
