'use client';

import { useRef, useState, useEffect } from 'react';

import { debeCargarseSolo } from 'src/utils/carga-automatica-actualizaciones.mjs';
import { puedeRevisarActualizacionesDeDestacamentos } from 'src/utils/org-level-access';

import {
  cargarAutomaticamente,
  escucharCargaAutomatica,
  escucharActualizacionesDeDestacamentos,
} from 'src/services/actualizaciones-destacamentos-service';

// ----------------------------------------------------------------------
// EL VIGILANTE DE LA CARGA AUTOMÁTICA.
//
// Va en el layout del dashboard: con el interruptor encendido, la sesión de
// quien puede revisar la bandeja (Administrador Global u Oficina Nacional)
// carga sola cada envío nuevo, en cualquier pantalla. Uno detrás de otro (la API
// .NET es lenta) y cada uno reservado antes, para que dos sesiones abiertas no lo
// carguen dos veces. Ver src/utils/carga-automatica-actualizaciones.mjs.
// ----------------------------------------------------------------------

export function useCargaAutomaticaDeActualizaciones(user) {
  const puede = puedeRevisarActualizacionesDeDestacamentos(user);
  const [config, setConfig] = useState({ activa: false });
  const [filas, setFilas] = useState([]);
  const trabajando = useRef(false);
  const usuarioRef = useRef(user);
  usuarioRef.current = user;

  useEffect(() => (puede ? escucharCargaAutomatica(setConfig) : undefined), [puede]);

  // La bandeja solo se escucha con el interruptor encendido: apagado no cuesta
  // ni una lectura.
  useEffect(
    () =>
      puede && config.activa
        ? escucharActualizacionesDeDestacamentos(setFilas, () => setFilas([]))
        : undefined,
    [puede, config.activa]
  );

  useEffect(() => {
    if (!puede || !config.activa || trabajando.current) return;
    const cola = filas.filter((fila) => debeCargarseSolo(fila, config));
    if (!cola.length) return;

    trabajando.current = true;
    (async () => {
      try {
        for (const fila of cola) {
          await cargarAutomaticamente(fila, usuarioRef.current);
        }
      } finally {
        trabajando.current = false;
      }
    })();
  }, [puede, config, filas]);
}
