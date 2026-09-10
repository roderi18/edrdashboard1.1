'use client';

import { useRef, useMemo, useState, useCallback } from 'react';

import { sanearDiseno } from 'src/utils/store-header-design.mjs';

// ----------------------------------------------------------------------
// DESHACER, REHACER Y VOLVER AL ORIGINAL.
//
// Tres pilas y ninguna sorpresa: lo que hubo, lo que hay y lo que se deshizo.
//
// EL ARRASTRE NO LLENA EL HISTORIAL. Mover un texto dispara decenas de cambios
// por segundo; si cada uno entrara, "deshacer" retrocederia un pixel y haria
// falta pulsarlo cuarenta veces para dejar el texto donde estaba. Por eso los
// cambios continuos se FUSIONAN con el anterior mientras lleven la misma
// etiqueta, y solo al soltar empieza uno nuevo.
// ----------------------------------------------------------------------

export function useDisenoHistorial(inicial) {
  const original = useMemo(() => sanearDiseno(inicial), [inicial]);

  const [pasado, setPasado] = useState([]);
  const [presente, setPresente] = useState(original);
  const [futuro, setFuturo] = useState([]);

  // La etiqueta del ultimo cambio, para saber si el siguiente es continuacion
  // del mismo gesto o uno nuevo.
  const gesto = useRef(null);

  const aplicar = useCallback((siguiente, etiqueta = null) => {
    setPresente((actual) => {
      const nuevo = sanearDiseno(typeof siguiente === 'function' ? siguiente(actual) : siguiente);

      const fusionar = etiqueta !== null && gesto.current === etiqueta;
      gesto.current = etiqueta;

      if (!fusionar) setPasado((pila) => [...pila, actual]);

      setFuturo([]);

      return nuevo;
    });
  }, []);

  /** Cierra el gesto en curso: el proximo cambio abre entrada propia. */
  const cerrarGesto = useCallback(() => {
    gesto.current = null;
  }, []);

  const deshacer = useCallback(() => {
    gesto.current = null;

    setPasado((pila) => {
      if (!pila.length) return pila;

      const anterior = pila[pila.length - 1];

      setPresente((actual) => {
        setFuturo((adelante) => [actual, ...adelante]);

        return anterior;
      });

      return pila.slice(0, -1);
    });
  }, []);

  const rehacer = useCallback(() => {
    gesto.current = null;

    setFuturo((pila) => {
      if (!pila.length) return pila;

      const siguiente = pila[0];

      setPresente((actual) => {
        setPasado((atras) => [...atras, actual]);

        return siguiente;
      });

      return pila.slice(1);
    });
  }, []);

  /** Vuelve al diseño con el que se abrio el editor, deshacible como todo. */
  const restaurar = useCallback(() => {
    gesto.current = null;

    setPresente((actual) => {
      setPasado((pila) => [...pila, actual]);
      setFuturo([]);

      return original;
    });
  }, [original]);

  return {
    diseno: presente,
    original,
    aplicar,
    cerrarGesto,
    deshacer,
    rehacer,
    restaurar,
    sePuedeDeshacer: pasado.length > 0,
    sePuedeRehacer: futuro.length > 0,
    hayCambios: JSON.stringify(presente) !== JSON.stringify(original),
  };
}
