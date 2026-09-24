'use client';

import { useEffect } from 'react';
import dynamic from 'next/dynamic';

// ----------------------------------------------------------------------
// EL VISOR DE IMÁGENES, SOLO CUANDO SE ABRE.
//
// `yet-another-react-lightbox` (con sus plugins y su CSS) viajaba con cada
// galería, perfil y chat, porque el visor se pinta siempre —cerrado— junto a las
// fotos. Ahora, cerrado no pinta nada, y la librería se descarga en segundo
// plano cuando el navegador queda libre: al pulsar una foto ya está y abre al
// momento.
// ----------------------------------------------------------------------

const cargarVisor = () => import('./lightbox');

const VisorReal = dynamic(() => cargarVisor().then((modulo) => modulo.Lightbox), { ssr: false });

export function Lightbox(props) {
  useEffect(() => {
    const precargar = () => cargarVisor().catch(() => {});

    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(precargar, { timeout: 4000 });
      return () => window.cancelIdleCallback(id);
    }

    const id = window.setTimeout(precargar, 2500);
    return () => window.clearTimeout(id);
  }, []);

  if (!props.open) return null;

  return <VisorReal {...props} />;
}
