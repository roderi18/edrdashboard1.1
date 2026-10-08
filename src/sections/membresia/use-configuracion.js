'use client';

import { useState, useEffect } from 'react';

// ----------------------------------------------------------------------
// La configuración pública de la membresía (planes, vigencia, tasa, banco),
// que la Oficina Nacional cambia desde el dashboard. Una sola petición por
// página aunque la pidan la portada, el marco y los pasos.
// ----------------------------------------------------------------------

const CERRADA = {
  lanzamientoHabilitado: false,
  paypalEnabled: false,
  bank: null,
  planes: [],
  vigencia: null,
};

let pendiente = null;

export const pedirConfiguracion = () => {
  if (!pendiente) {
    pendiente = fetch('/api/configuracion/')
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .catch(() => {
        pendiente = null;
        return CERRADA;
      });
  }
  return pendiente;
};

export function useConfiguracion() {
  const [configuracion, setConfiguracion] = useState(null);
  useEffect(() => {
    let vivo = true;
    pedirConfiguracion().then((c) => vivo && setConfiguracion(c));
    return () => {
      vivo = false;
    };
  }, []);
  return configuracion;
}
