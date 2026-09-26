import { useRef, useState, useEffect, useCallback } from 'react';

import { MAP_WIDTH, MAP_HEIGHT } from './geometria-mapa.mjs';
import { medirDedos, VISTA_INICIAL, acercarEnPunto } from './gestos-mapa.mjs';

export function useGestosMapa(svgRef) {
  const [vista, setVista] = useState(VISTA_INICIAL);
  const [arrastrando, setArrastrando] = useState(false);
  const vistaRef = useRef(VISTA_INICIAL);
  const dedos = useRef(new Map());
  const gesto = useRef(null);

  const actualizar = useCallback((siguiente) => {
    vistaRef.current = siguiente;
    setVista(siguiente);
  }, []);

  const posicion = useCallback(
    (evento) => {
      const matriz = svgRef.current?.getScreenCTM();
      return matriz
        ? new DOMPoint(evento.clientX, evento.clientY).matrixTransform(matriz.inverse())
        : null;
    },
    [svgRef]
  );

  const iniciarGesto = useCallback(() => {
    gesto.current = dedos.current.size
      ? { ...medirDedos([...dedos.current.values()]), vista: vistaRef.current }
      : null;
  }, []);

  const onPointerDown = useCallback(
    (evento) => {
      if (evento.pointerType === 'mouse' && evento.button !== 0) return;
      const punto = posicion(evento);
      if (!punto) return;
      evento.currentTarget.setPointerCapture(evento.pointerId);
      dedos.current.set(evento.pointerId, punto);
      iniciarGesto();
      setArrastrando(true);
    },
    [posicion, iniciarGesto]
  );

  const onPointerMove = useCallback(
    (evento) => {
      if (!dedos.current.has(evento.pointerId)) return;
      const punto = posicion(evento);
      if (!punto || !gesto.current) return;
      dedos.current.set(evento.pointerId, punto);
      const actual = medirDedos([...dedos.current.values()]);
      const inicio = gesto.current;
      const escala =
        inicio.distancia > 0 && dedos.current.size > 1
          ? (inicio.vista.zoom * actual.distancia) / inicio.distancia
          : inicio.vista.zoom;
      actualizar(acercarEnPunto(inicio.vista, escala, inicio.centro, actual.centro));
    },
    [posicion, actualizar]
  );

  const terminar = useCallback(
    (evento) => {
      if (!dedos.current.has(evento.pointerId)) return;
      dedos.current.delete(evento.pointerId);
      if (evento.currentTarget.hasPointerCapture(evento.pointerId)) {
        evento.currentTarget.releasePointerCapture(evento.pointerId);
      }
      // Al levantar un dedo, el restante continúa desde la vista actual.
      iniciarGesto();
      setArrastrando(dedos.current.size > 0);
    },
    [iniciarGesto]
  );

  useEffect(() => {
    const svg = svgRef.current;
    const rueda = (evento) => {
      evento.preventDefault();
      const centro = posicion(evento);
      if (!centro || dedos.current.size) return;
      const delta =
        evento.deltaY * (evento.deltaMode === 1 ? 16 : evento.deltaMode === 2 ? 620 : 1);
      actualizar(
        acercarEnPunto(vistaRef.current, vistaRef.current.zoom * Math.exp(-delta * 0.002), centro)
      );
    };
    // React registra wheel como pasivo; aquí se evita que el navegador amplíe la página.
    svg?.addEventListener('wheel', rueda, { passive: false });
    return () => svg?.removeEventListener('wheel', rueda);
  }, [svgRef, posicion, actualizar]);

  return {
    vista,
    arrastrando,
    restablecer: () => actualizar(VISTA_INICIAL),
    ampliar: (factor) =>
      actualizar(
        acercarEnPunto(vistaRef.current, vistaRef.current.zoom * factor, {
          x: MAP_WIDTH / 2,
          y: MAP_HEIGHT / 2,
        })
      ),
    eventos: {
      onPointerDown,
      onPointerMove,
      onPointerUp: (evento) => terminar(evento),
      onPointerCancel: terminar,
      onLostPointerCapture: terminar,
    },
  };
}
