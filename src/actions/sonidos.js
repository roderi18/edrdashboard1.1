import { useRef, useEffect } from 'react';

import { prepararAudio, fijarEleccionDeSonidos } from 'src/utils/sonidos-de-aviso.mjs';

import {
  leerCopiaLocal,
  guardarCopiaLocal,
  obtenerSonidosDeAviso,
} from 'src/services/sonidos-service';

// ----------------------------------------------------------------------
// DEJAR LISTOS LOS SONIDOS AL ENTRAR.
//
// Se llama una vez, en el marco del panel: primero la copia del navegador —para
// que el primer mensaje que llegue ya suene como debe— y despues lo que diga
// Firestore, que es lo que manda.
// ----------------------------------------------------------------------

export function useCargarSonidosDeAviso(activo = true) {
  const yaCargado = useRef(false);

  useEffect(() => {
    if (!activo || yaCargado.current) return;

    yaCargado.current = true;
    fijarEleccionDeSonidos(leerCopiaLocal());

    obtenerSonidosDeAviso()
      .then((eleccion) => {
        fijarEleccionDeSonidos(eleccion);
        guardarCopiaLocal(eleccion);
      })
      .catch(() => {
        // Sin configuracion guardada suenan los de fabrica: un aviso sin sonido
        // no puede dejar la aplicacion a medias.
      });

    // El audio, despierto desde el primer gesto. Una sola vez, y en captura para
    // no depender de que el clic llegue hasta aqui.
    const despertar = () => prepararAudio();

    window.addEventListener('pointerdown', despertar, { once: true, capture: true });
    window.addEventListener('keydown', despertar, { once: true, capture: true });
  }, [activo]);
}
