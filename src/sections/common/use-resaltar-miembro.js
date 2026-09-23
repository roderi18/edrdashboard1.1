'use client';

import { useEffect } from 'react';

// ----------------------------------------------------------------------
// RESALTAR A UNA PERSONA EN EL ORGANIGRAMA.
//
// El buscador de la pestaña Jerarquía elige a UN miembro y hay que hacerlo notar
// dentro del arbol. En vez de tocar cada nodo, se resuelve en la vista: se busca
// la casilla que ocupa esa persona, se le pega una clase que brilla unos segundos
// y se la trae al centro. El brillo vive en `GLOW_JERARQUIA_SX`, que se derrama en
// el contenedor del organigrama; asi la regla del resplandor esta en un solo sitio
// y los tres niveles (nacion, region, seccion) la comparten.
// ----------------------------------------------------------------------

const CLASE_RESALTADO = 'resaltado-jerarquia';
const DURACION_RESALTADO_MS = 3500;

// Primer nodo del arbol cuyo ocupante es `miembroId`. Se recorre entero porque un
// mismo diagrama tiene decenas de casillas y el ocupante se resuelve por posicion,
// no por el id del nodo.
const buscarNodoDeMiembro = (diagrama, obtenerOcupante, miembroId) => {
  if (!diagrama || !miembroId || typeof obtenerOcupante !== 'function') return '';

  const objetivo = String(miembroId);
  const pendientes = [diagrama];

  while (pendientes.length) {
    const nodo = pendientes.shift();
    const ocupante = obtenerOcupante(nodo.id);
    const idOcupante = ocupante ? String(ocupante.id ?? ocupante.idMiembros ?? '') : '';

    if (idOcupante && idOcupante === objetivo) return nodo.id;

    if (Array.isArray(nodo.children)) pendientes.push(...nodo.children);
  }

  return '';
};

export function useResaltarMiembro({
  containerRef,
  diagrama,
  obtenerOcupante,
  miembroId,
  // Cambia con cada búsqueda aunque el miembro sea el mismo: sin él, volver a
  // elegir a la misma persona no repetía el brillo porque las dependencias del
  // efecto no cambiaban.
  token = null,
}) {
  useEffect(() => {
    if (!miembroId) return undefined;

    const nodoId = buscarNodoDeMiembro(diagrama, obtenerOcupante, miembroId);

    if (!nodoId) return undefined;

    const elemento = containerRef.current?.querySelector(
      `[data-leadership-node-id="${nodoId}"]`
    );

    if (!elemento) return undefined;

    elemento.classList.add(CLASE_RESALTADO);
    // `center` en los dos ejes: el organigrama se navega con arrastre, asi que sin
    // traerlo al centro la persona podia quedar fuera de la ventana recortada.
    elemento.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });

    const temporizador = setTimeout(() => {
      elemento.classList.remove(CLASE_RESALTADO);
    }, DURACION_RESALTADO_MS);

    return () => {
      clearTimeout(temporizador);
      elemento.classList.remove(CLASE_RESALTADO);
    };
    // `token` fuerza el efecto otra vez al repetir el mismo nombre.
  }, [containerRef, diagrama, obtenerOcupante, miembroId, token]);
}

// El resplandor: un pulso del color primario alrededor de la casilla. Se derrama
// en el `sx` del contenedor del organigrama para que alcance a la clase que el
// hook pega sobre el nodo.
export const GLOW_JERARQUIA_SX = {
  [`& .${CLASE_RESALTADO}`]: {
    animation: 'resaltarJerarquia 1s ease-in-out 3',
    borderRadius: 1.5,
  },
  '@keyframes resaltarJerarquia': {
    // El verde de la casa por su canal del tema, no un hex suelto: arranca
    // transparente y crece a un halo opaco alrededor de la casilla.
    '0%, 100%': {
      boxShadow: '0 0 0 0 rgba(var(--palette-primary-mainChannel) / 0)',
    },
    '50%': {
      boxShadow: '0 0 0 6px rgba(var(--palette-primary-mainChannel) / 0.55)',
    },
  },
};
