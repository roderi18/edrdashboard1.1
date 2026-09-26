'use client';

import { useState, useEffect } from 'react';

import { combinarHistorialYVigentes } from 'src/utils/directiva-historial.mjs';

import { useLecturasVivas } from 'src/lib/avisos-de-lecturas';
import {
  obtenerHistorialDirectiva,
  obtenerAsignacionesDirectiva,
} from 'src/services/directivas-organizacionales-service';

import { LeadershipHistoryTable } from './leadership-history-table';

// ----------------------------------------------------------------------
// La pestaña "Historia" de UNA entidad puntual (un destacamento, una sección o
// una región): junta quién la ocupa hoy con quién la ocupó antes (30+ días,
// ver directiva-historial.mjs). La vista GLOBAL del Consejo Nacional arma sus
// propias filas aparte (no hay una sola entidad de la que leer).
// ----------------------------------------------------------------------

export function LeadershipHistoryTab({ nivel, idEntidad }) {
  const [vigentes, setVigentes] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [cargando, setCargando] = useState(Boolean(idEntidad));
  // Otra sesión asignó o reemplazó a alguien: la pestaña se relee sola.
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

  const filas = combinarHistorialYVigentes({ historial, vigentes });

  return <LeadershipHistoryTable filas={filas} loading={cargando} />;
}
