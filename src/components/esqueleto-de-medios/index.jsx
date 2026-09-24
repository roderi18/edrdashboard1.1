'use client';

import { useState, useEffect } from 'react';
import { varAlpha } from 'minimal-shared/utils';

import Box from '@mui/material/Box';
import { keyframes } from '@mui/material/styles';

// ----------------------------------------------------------------------
// ESQUELETO PARA FOTOS, AVATARES Y VIDEOS MIENTRAS LLEGAN.
//
// Qué se rompía: una foto que tardaba dejaba un hueco gris (o la inicial del
// nombre) y aparecía de golpe; un video de fondo enseñaba el navy liso hasta
// arrancar. Parecía que la pantalla no estaba lista. Ahora todo medio que se
// está cargando lleva la misma onda que los esqueletos de MUI, y se apaga sola
// al llegar.
//
// Cómo se sabe que llegó: los eventos `load` / `loadeddata` / `error` se
// capturan en un contenedor (el `main` del panel) y marcan el elemento con
// `data-cargado`. El CSS solo anima lo que no lo tiene: sin JavaScript por
// imagen, y la animación no sigue corriendo detrás de una foto ya pintada.
// ----------------------------------------------------------------------

const onda = keyframes`
  0% { background-position: 100% 0; }
  100% { background-position: -100% 0; }
`;

/** El brillo del esqueleto, como `sx` (fondo animado). */
export const brilloDeEsqueletoSx = (theme) => ({
  backgroundColor: theme.vars.palette.action.hover,
  backgroundImage: `linear-gradient(90deg, transparent 25%, ${varAlpha(
    theme.vars.palette.grey['500Channel'],
    0.16
  )} 50%, transparent 75%)`,
  backgroundSize: '200% 100%',
  backgroundRepeat: 'no-repeat',
  animation: `${onda} 1.4s ease-in-out infinite`,
});

// Solo fotos: avatares, `<img data-esqueleto>` y videos. No todas las `img`: un
// logo o un emblema con transparencia dejaría ver la onda por detrás mientras
// carga, y eso sí parecería un fallo.
const SELECTOR_DE_MEDIOS =
  '& .MuiAvatar-img:not([data-cargado]), & img[data-esqueleto]:not([data-cargado]), & video:not([data-cargado])';

export const esqueletoDeMediosSx = (theme) => ({
  [SELECTOR_DE_MEDIOS]: brilloDeEsqueletoSx(theme),
});

const marcarCargado = (event) => {
  const elemento = event.target;

  if (elemento?.dataset && !elemento.dataset.cargado) {
    elemento.dataset.cargado = 'si';
  }
};

// Lo que ya estaba cargado cuando React empezó a escuchar (imagen en caché del
// navegador, o pintada desde el HTML del servidor antes de hidratar) no dispara
// `load` otra vez: sin esto, esa foto se quedaba con la onda debajo para siempre.
const yaEstaCargado = (elemento) =>
  elemento.tagName === 'IMG' ? elemento.complete : elemento.readyState >= 2;

const marcarLosYaCargados = (raiz) => {
  raiz
    .querySelectorAll('img:not([data-cargado]), video:not([data-cargado])')
    .forEach((elemento) => {
      if (yaEstaCargado(elemento)) elemento.dataset.cargado = 'si';
    });
};

/**
 * Marca los medios que ya llegaron cargados dentro de `selector` (al montar y
 * cada vez que se pintan nuevos). Lo que aún carga lo marcan los manejadores.
 */
export function useMediosYaCargados(selector = 'main') {
  useEffect(() => {
    const raiz = document.querySelector(selector);
    if (!raiz) return undefined;

    marcarLosYaCargados(raiz);

    let pendiente = null;
    const observador = new MutationObserver(() => {
      // Juntar ráfagas de cambios en un solo recorrido por fotograma.
      if (pendiente) return;
      pendiente = requestAnimationFrame(() => {
        pendiente = null;
        marcarLosYaCargados(raiz);
      });
    });

    observador.observe(raiz, { childList: true, subtree: true });

    return () => {
      observador.disconnect();
      if (pendiente) cancelAnimationFrame(pendiente);
    };
  }, [selector]);
}

/** Los manejadores que se ponen en el contenedor (capturan los de sus hijos). */
export const manejadoresDeMedios = {
  onLoadCapture: marcarCargado,
  onErrorCapture: marcarCargado,
  onLoadedDataCapture: marcarCargado,
};

// ----------------------------------------------------------------------

// URLs ya descargadas en esta pestaña: al volver a una tarjeta, su fondo sale
// sin esqueleto de paso.
const yaCargadas = new Set();

/**
 * Si una imagen de FONDO (CSS `background-image`, que no avisa al cargar) ya
 * está lista. Se precarga con `new Image()`; un fallo cuenta como listo para no
 * dejar el esqueleto para siempre. Sin URL, no hay nada que esperar.
 */
export function useFondoCargado(url, { esVideo = false } = {}) {
  const [cargadoDe, setCargadoDe] = useState(() => (url && yaCargadas.has(url) ? url : ''));

  useEffect(() => {
    // Un video avisa por sí mismo (`loadeddata` en `FondoEnVideo`).
    if (!url || esVideo || yaCargadas.has(url)) return undefined;

    let vigente = true;
    const imagen = new window.Image();
    const listo = () => {
      yaCargadas.add(url);
      if (vigente) setCargadoDe(url);
    };

    imagen.onload = listo;
    imagen.onerror = listo;
    imagen.src = url;

    return () => {
      vigente = false;
    };
  }, [url, esVideo]);

  if (!url || esVideo) return true;

  return cargadoDe === url || yaCargadas.has(url);
}

/** La onda encima de una tarjeta mientras su fondo no está. Se desvanece al llegar. */
export function CapaDeEsqueleto({ visible, sx }) {
  return (
    <Box
      aria-hidden
      sx={[
        (theme) => ({
          ...brilloDeEsqueletoSx(theme),
          inset: 0,
          zIndex: 0,
          position: 'absolute',
          pointerEvents: 'none',
          opacity: visible ? 1 : 0,
          transition: theme.transitions.create('opacity', { duration: 300 }),
          // Apagada, la animación no sigue gastando.
          ...(!visible && { animation: 'none' }),
        }),
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    />
  );
}
