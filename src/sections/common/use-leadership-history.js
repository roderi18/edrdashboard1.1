'use client';

import { useState, useEffect } from 'react';

import { combinarHistorialYVigentes } from 'src/utils/directiva-historial.mjs';

import { useLecturasVivas } from 'src/lib/avisos-de-lecturas';
import {
  obtenerHistorialDirectiva,
  obtenerAsignacionesDirectiva,
} from 'src/services/directivas-organizacionales-service';

// ----------------------------------------------------------------------
// Quién ocupa HOY un cargo de directiva de UNA entidad (destacamento, sección
// o región) + quién lo ocupó antes (30+ días, ver directiva-historial.mjs),
// combinado en una sola lista. Sin importar de qué organigrama salga el cargo
// (en destacamento hay dos: Directiva Local y Líderes Juveniles): las dos
// escriben el mismo nivel + entidad, así que una sola lectura las junta.
// ----------------------------------------------------------------------

export function useLeadershipHistory({ nivel, idEntidad }) {
  const [vigentes, setVigentes] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [cargando, setCargando] = useState(Boolean(idEntidad));
  // Otra sesión asignó o reemplazó a alguien: la lista se relee sola.
  const cambios = useLecturasVivas(['directiva:']);

  useEffect(() => {
    let cancelado = false;

    if (!idEntidad) {
      setVigentes([]);
      setHistorial([]);
      setCargando(false);
      return undefined;
    }

    setCargando(true);

    Promise.all([
      obtenerAsignacionesDirectiva({ nivel, idEntidad }).catch(() => []),
      obtenerHistorialDirectiva({ nivel, idEntidad }).catch(() => []),
    ]).then(([asignaciones, filasHistorial]) => {
      if (cancelado) return;

      setVigentes(Array.isArray(asignaciones) ? asignaciones : []);
      setHistorial(Array.isArray(filasHistorial) ? filasHistorial : []);
      setCargando(false);
    });

    return () => {
      cancelado = true;
    };
  }, [nivel, idEntidad, cambios]);

  return { filas: combinarHistorialYVigentes({ historial, vigentes }), cargando };
}
