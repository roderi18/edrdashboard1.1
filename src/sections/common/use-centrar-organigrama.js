'use client';

import { useRef, useState, useEffect } from 'react';

// ----------------------------------------------------------------------
// EL ORGANIGRAMA, CENTRADO COMO UN SOLO GRUPO.
//
// El arbol se centraba por su raiz: la columna de arriba quedaba en el medio,
// pero la fila ancha de abajo (y cualquier casilla movida en el diseño) se iba
// hacia un lado y el conjunto se veia cargado a la izquierda. Cada vista lo
// compensaba con un `DEFAULT_PAN.x` ajustado a ojo, que dejaba de valer en
// cuanto cambiaba el zoom, el ancho de la pantalla o el diseño guardado.
//
// Aqui se mide la caja que envuelve TODOS los recuadros (`data-leadership-node-id`)
// y se devuelve el desplazamiento horizontal que pone su centro en el centro del
// contenedor. El arrastre del usuario (`pan`) se respeta como un desplazamiento
// sobre ese centro: al volver a medir no se pierde.
//
// Mientras se edita el diseño no se recentra: cada casilla movida desplazaria
// todo el arbol bajo el puntero. Se recentra al salir de la edicion.
// ----------------------------------------------------------------------

const medirDesplazamiento = (contenedor) => {
  const recuadros = contenedor.querySelectorAll('[data-leadership-node-id]');
  let izquierda = Infinity;
  let derecha = -Infinity;

  recuadros.forEach((recuadro) => {
    const caja = recuadro.getBoundingClientRect();

    if (!caja.width) return;

    izquierda = Math.min(izquierda, caja.left);
    derecha = Math.max(derecha, caja.right);
  });

  if (!Number.isFinite(izquierda) || !Number.isFinite(derecha)) return null;

  const cajaContenedor = contenedor.getBoundingClientRect();

  return cajaContenedor.left + cajaContenedor.width / 2 - (izquierda + derecha) / 2;
};

export function useCentrarOrganigrama({ containerRef, pan, pausado = false, claves = [] }) {
  const [desplazamiento, setDesplazamiento] = useState(0);
  const actual = useRef({ pan, desplazamiento });

  actual.current = { pan, desplazamiento };

  useEffect(() => {
    const contenedor = containerRef.current;

    if (pausado || !contenedor) return undefined;

    let frame = 0;

    const centrar = () => {
      window.cancelAnimationFrame(frame);
      // Dos fotogramas: el primero aplica estilos y desplazamientos del diseño,
      // el segundo ya tiene las cajas en su sitio.
      frame = window.requestAnimationFrame(() => {
        frame = window.requestAnimationFrame(() => {
          const diferencia = medirDesplazamiento(contenedor);

          if (diferencia === null) return;

          // Se mide con el arrastre puesto, asi que el centro "sin arrastre" es
          // lo de antes + la diferencia + el arrastre: el `pan` sigue siendo un
          // extra encima del centro y no se pierde al recentrar.
          const { pan: panActual, desplazamiento: previo } = actual.current;
          setDesplazamiento(Math.round(previo + diferencia + (Number(panActual?.x) || 0)));
        });
      });
    };

    centrar();

    // Cambiar el ancho (ventana, menu lateral) cambia la escala base del arbol.
    const observador = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(centrar);
    observador?.observe(contenedor);

    return () => {
      window.cancelAnimationFrame(frame);
      observador?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef, pausado, ...claves]);

  return desplazamiento;
}
