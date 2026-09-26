'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';

import { casillasVigentes } from 'src/utils/casillas-personalizadas.mjs';

import { useLecturasVivas } from 'src/lib/avisos-de-lecturas';
import {
  obtenerCasillasPersonalizadas,
  casillasPersonalizadasGuardadas,
} from 'src/services/directivas-organizacionales-service';

// ----------------------------------------------------------------------
// Las casillas añadidas desde los organigramas, para quien las dibuja o las
// nombra. Leerlas también las REGISTRA en el catálogo de posiciones: por eso
// cada pantalla que pinta un organigrama o traduce un cargo llama a este hook,
// aunque luego no use la lista.
//
// Arranca con lo ya leído (sin esqueleto al volver) y se relee cuando otra
// sesión —u otra pestaña— añade o quita una.
// ----------------------------------------------------------------------

export function useCasillasPersonalizadas() {
  const [todas, setTodas] = useState(() => casillasPersonalizadasGuardadas() || []);
  const [cargando, setCargando] = useState(() => casillasPersonalizadasGuardadas() === undefined);
  const version = useLecturasVivas(['directiva:']);
  // El aviso entre sesiones no llega a la propia: quien crea una casilla pide
  // releer con esto, y la ve al instante.
  const [propia, setPropia] = useState(0);
  const recargar = useCallback(() => setPropia((actual) => actual + 1), []);

  useEffect(() => {
    let vigente = true;

    obtenerCasillasPersonalizadas()
      .then((lista) => {
        if (!vigente) return;

        const siguiente = Array.isArray(lista) ? lista : [];

        // Misma lista, mismo objeto: cualquier cambio de la directiva (una
        // asignación en otra sesión) relee esto, y una lista nueva con lo mismo
        // dentro redibujaba el árbol y relanzaba la carga de ocupantes.
        setTodas((actual) =>
          JSON.stringify(actual) === JSON.stringify(siguiente) ? actual : siguiente
        );
      })
      // Sin casillas añadidas el organigrama se pinta como el de fábrica.
      .catch(() => {})
      .finally(() => {
        if (vigente) setCargando(false);
      });

    return () => {
      vigente = false;
    };
  }, [version, propia]);

  // Memoizada: una lista nueva en cada pintado hacía que el destacamento
  // volviera a pedir sus asignaciones sin fin (el efecto depende de ella).
  const casillas = useMemo(() => casillasVigentes(todas), [todas]);

  return { casillas, todas, cargando, recargar };
}
