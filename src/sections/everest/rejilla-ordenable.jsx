'use client';

import { m } from 'framer-motion';
import { useRef, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Portal from '@mui/material/Portal';

// ----------------------------------------------------------------------
// REJILLA QUE SE ORDENA ARRASTRANDO (cintas y medallas de EXPLORA Designer).
//
// Con el arrastre nativo del navegador apenas se veía una sombra borrosa de la
// tarjeta y el orden no cambiaba hasta soltar: no se sabía dónde iba a caer.
// Aquí la tarjeta que se arrastra SIGUE AL PUNTERO, entera y del mismo tamaño,
// y las demás se van apartando en vivo (`layout` de framer-motion) mientras se
// pasa por encima. Funciona igual con ratón, con el dedo y con lápiz.
//
// Un clic no es un arrastre: hace falta mover unos píxeles, así los botones de
// cada tarjeta (las flechas) siguen funcionando.
// ----------------------------------------------------------------------

const UMBRAL_PX = 6;
const RESORTE = { type: 'spring', stiffness: 520, damping: 38, mass: 0.7 };
const INTERACTIVOS = 'button, a, input, textarea, select, [role="button"]';

/**
 * @param {Array<{id: string}>} items
 * @param {(item, indice, { arrastrando }) => node} renderItem
 * @param {(idQueSeMueve: string, idDestino: string) => void} onMover  Se llama en
 *   vivo, cada vez que la tarjeta pasa sobre otra.
 * @param {() => void} [onSoltar]
 */
export function RejillaOrdenable({ items, renderItem, onMover, onSoltar, deshabilitado, sx }) {
  const rejillaRef = useRef(null);
  const inicioRef = useRef(null);
  const ultimoDestinoRef = useRef('');
  const [arrastre, setArrastre] = useState(null);

  const arrastrandoRef = useRef(false);

  const terminar = useCallback(() => {
    const habiaArrastre = arrastrandoRef.current;

    inicioRef.current = null;
    ultimoDestinoRef.current = '';
    arrastrandoRef.current = false;
    setArrastre(null);

    if (habiaArrastre) onSoltar?.();
  }, [onSoltar]);

  useEffect(() => {
    if (!arrastre) return undefined;

    // Mientras se arrastra no se selecciona texto ni se desplaza la página con
    // el dedo.
    const anterior = document.body.style.userSelect;
    document.body.style.userSelect = 'none';

    return () => {
      document.body.style.userSelect = anterior;
    };
  }, [arrastre]);

  const alPulsar = (evento, id) => {
    if (deshabilitado || evento.button > 0) return;
    if (evento.target.closest?.(INTERACTIVOS)) return;

    const caja = evento.currentTarget.getBoundingClientRect();

    inicioRef.current = {
      id,
      x: evento.clientX,
      y: evento.clientY,
      dx: evento.clientX - caja.left,
      dy: evento.clientY - caja.top,
      ancho: caja.width,
      alto: caja.height,
    };
    // El movimiento se escucha en TODA la ventana: la tarjeta se queda atrás en
    // cuanto el puntero sale de ella, y sin esto el arrastre se cortaba ahí.
    window.addEventListener('pointermove', escuchasRef.current.mover);
    window.addEventListener('pointerup', escuchasRef.current.soltar);
    window.addEventListener('pointercancel', escuchasRef.current.soltar);
  };

  const alMover = (evento) => {
    const inicio = inicioRef.current;

    if (!inicio) return;

    if (!arrastrandoRef.current) {
      const distancia = Math.hypot(evento.clientX - inicio.x, evento.clientY - inicio.y);

      if (distancia < UMBRAL_PX) return;
    }

    arrastrandoRef.current = true;
    setArrastre({ ...inicio, x: evento.clientX, y: evento.clientY });

    // LA CASILLA, NO LO QUE SE VE. Mientras las tarjetas se apartan van
    // animándose, y preguntar qué hay bajo el puntero devolvía la que pasaba por
    // ahí de camino: la cinta caía dos sitios más allá. `offsetLeft/Top` es la
    // posición de la casilla en la rejilla, que la animación no cambia.
    const rejilla = rejillaRef.current;
    const caja = rejilla?.getBoundingClientRect();
    const px = evento.clientX - (caja?.left ?? 0);
    const py = evento.clientY - (caja?.top ?? 0);
    const debajo = [...(rejilla?.children ?? [])].find(
      (casilla) =>
        px >= casilla.offsetLeft &&
        px <= casilla.offsetLeft + casilla.offsetWidth &&
        py >= casilla.offsetTop &&
        py <= casilla.offsetTop + casilla.offsetHeight
    );
    const destino = debajo?.getAttribute('data-orden-id') || '';

    if (!destino || destino === inicio.id) {
      ultimoDestinoRef.current = '';
      return;
    }

    // Una vez por casilla: sin esto, cada movimiento del puntero dentro de la
    // misma volvía a mover la cinta.
    if (destino === ultimoDestinoRef.current) return;

    ultimoDestinoRef.current = destino;
    onMover(inicio.id, destino);
  };

  // Las escuchas de la ventana son SIEMPRE las mismas funciones —si no, al
  // soltar no se podrían quitar— y por dentro llaman a la versión más reciente.
  const ultimosRef = useRef({});
  const escuchasRef = useRef(null);

  ultimosRef.current = { alMover, terminar };

  if (!escuchasRef.current) {
    const escuchas = {
      mover: (evento) => ultimosRef.current.alMover(evento),
      soltar: () => {
        window.removeEventListener('pointermove', escuchas.mover);
        window.removeEventListener('pointerup', escuchas.soltar);
        window.removeEventListener('pointercancel', escuchas.soltar);
        ultimosRef.current.terminar();
      },
    };

    escuchasRef.current = escuchas;
  }

  // Si la pantalla se cierra a medio arrastre, que no queden escuchando.
  useEffect(() => () => escuchasRef.current?.soltar(), []);

  const itemArrastrado = arrastre ? items.find((item) => item.id === arrastre.id) : null;
  const indiceArrastrado = itemArrastrado ? items.indexOf(itemArrastrado) : -1;

  return (
    <>
      <Box
        ref={rejillaRef}
        // `relative`: las casillas miden su posición contra la rejilla.
        sx={[{ gap: 2, display: 'grid', position: 'relative' }, ...(Array.isArray(sx) ? sx : [sx])]}
      >
        {items.map((item, indice) => {
          const esElArrastrado = arrastre?.id === item.id;

          return (
            <Box
              key={item.id}
              component={m.div}
              layout
              transition={RESORTE}
              data-orden-id={item.id}
              onPointerDown={(evento) => alPulsar(evento, item.id)}
              sx={(theme) => ({
                minWidth: 0,
                borderRadius: 1,
                position: 'relative',
                touchAction: deshabilitado ? 'auto' : 'none',
                cursor: deshabilitado ? 'default' : arrastre ? 'grabbing' : 'grab',
                // El hueco donde caerá: se ve dónde va a quedar al soltar.
                ...(esElArrastrado && {
                  outline: `2px dashed ${theme.vars.palette.primary.main}`,
                  outlineOffset: -2,
                  '& > *': { opacity: 0.25 },
                }),
              })}
            >
              {renderItem(item, indice, { arrastrando: Boolean(arrastre) })}
            </Box>
          );
        })}
      </Box>

      {itemArrastrado && (
        <Portal>
          <Box
            // La posicion va en `style` y no en `sx`: cambia en cada movimiento
            // del puntero, y en `sx` crearia una clase CSS nueva cada vez.
            style={{
              width: arrastre.ancho,
              height: arrastre.alto,
              transform: `translate(${arrastre.x - arrastre.dx}px, ${arrastre.y - arrastre.dy}px) rotate(-2deg) scale(1.05)`,
            }}
            sx={(theme) => ({
              position: 'fixed',
              zIndex: theme.zIndex.tooltip + 1,
              left: 0,
              top: 0,
              pointerEvents: 'none',
              borderRadius: 1,
              bgcolor: 'background.paper',
              boxShadow: theme.vars.customShadows?.z24 ?? theme.shadows[16],
              outline: `2px solid ${theme.vars.palette.primary.main}`,
            })}
          >
            {renderItem(itemArrastrado, indiceArrastrado, { arrastrando: true, flotante: true })}
          </Box>
        </Portal>
      )}
    </>
  );
}
