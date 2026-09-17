import { useEffect, useCallback } from 'react';

import { PANTALLAS_EXPLORA } from 'src/utils/everest/colecciones.mjs';

import {
  registrarClicDePortada,
  registrarImpresionesDePortada,
} from 'src/services/everest-analiticas-service';

// ----------------------------------------------------------------------
// CONTAR LO QUE SE VE Y LO QUE SE PULSA EN LA PORTADA (EXPLORA, fase 8).
//
// Cada tarjeta lleva `data-everest-bloque="<id>"`, un atributo que no se ve. Aqui
// se miran esas marcas:
//
//   - VISTA: cuando al menos media tarjeta entra en pantalla. Una tarjeta al
//     final de la columna que nadie bajo a ver no es una impresion.
//   - PULSACION: un clic en un enlace o boton DENTRO de la tarjeta, recogido en
//     la raiz (`onClickCapture`) para no tocar cada boton.
//
// El Administrador Global no cuenta: es quien entra a comprobar lo que publico, y
// sus visitas inflarian justo los numeros con los que decide.
// ----------------------------------------------------------------------

const PANTALLA = PANTALLAS_EXPLORA.principal;

const quienEs = (portada, idBloque) => ({
  idBloque,
  idCampana: portada?.[idBloque]?.idCampana || undefined,
});

export function useAnaliticasDePortada({ raizRef, portada, activo = true }) {
  useEffect(() => {
    const raiz = raizRef.current;

    if (!activo || !raiz || typeof IntersectionObserver === 'undefined') return undefined;

    const vistos = new Set();
    let pendiente = null;

    // Se juntan las que entran a la vez en una sola escritura.
    const enviar = () => {
      pendiente = null;
      registrarImpresionesDePortada(
        PANTALLA,
        [...vistos].map((idBloque) => quienEs(portada, idBloque))
      );
    };

    const observador = new IntersectionObserver(
      (entradas) => {
        entradas.forEach((entrada) => {
          const idBloque = entrada.target.getAttribute('data-everest-bloque');

          if (entrada.isIntersecting && idBloque && !vistos.has(idBloque)) {
            vistos.add(idBloque);
            observador.unobserve(entrada.target);
            if (!pendiente) pendiente = setTimeout(enviar, 1500);
          }
        });
      },
      { threshold: 0.5 }
    );

    raiz
      .querySelectorAll('[data-everest-bloque]')
      .forEach((tarjeta) => observador.observe(tarjeta));

    return () => {
      observador.disconnect();
      if (pendiente) {
        clearTimeout(pendiente);
        enviar();
      }
    };
  }, [activo, portada, raizRef]);

  return useCallback(
    (evento) => {
      if (!activo) return;

      const tarjeta = evento.target?.closest?.('[data-everest-bloque]');
      const enlace = evento.target?.closest?.('a, button');
      // El lapiz del Designer no es una pulsacion de nadie que lea la portada.
      const esLapiz = enlace?.getAttribute('aria-label') === 'Editar en EXPLORA Designer';

      if (!tarjeta || !enlace || esLapiz) return;

      registrarClicDePortada(
        PANTALLA,
        quienEs(portada, tarjeta.getAttribute('data-everest-bloque'))
      );
    },
    [activo, portada]
  );
}
