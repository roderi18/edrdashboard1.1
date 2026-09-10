'use client';

import { useState, useEffect } from 'react';

import Box from '@mui/material/Box';

import { tiempoRestante, formatearCuenta } from 'src/utils/store-header-design.mjs';

// ----------------------------------------------------------------------
// LA CUENTA REGRESIVA DE UNA OFERTA.
//
// El reloj lo lleva el NAVEGADOR de quien mira, no el servidor: la cuenta se
// calcula contra el instante guardado en UTC, asi que dos personas en husos
// distintos ven el mismo tiempo restante aunque sus relojes marquen horas
// diferentes.
//
// Se refresca cada segundo y SOLO mientras esta en pantalla. Un intervalo que
// sigue corriendo con la pestaña de fondo no cambia nada que nadie este viendo
// y despierta el procesador cada segundo, que en un movil se nota en la bateria.
// ----------------------------------------------------------------------

export function CuentaRegresiva({ hasta, textoFinal, formato, prefijo, ...other }) {
  const [restante, setRestante] = useState(() => tiempoRestante(hasta));

  useEffect(() => {
    setRestante(tiempoRestante(hasta));

    // Terminada no hay nada que contar: el intervalo sobra.
    if (tiempoRestante(hasta).terminado) return undefined;

    const reloj = setInterval(() => {
      const siguiente = tiempoRestante(hasta);

      setRestante(siguiente);

      if (siguiente.terminado) clearInterval(reloj);
    }, 1000);

    return () => clearInterval(reloj);
  }, [hasta]);

  return (
    <Box
      component="span"
      // Se anuncia con cortesia: un reloj que interrumpe al lector de pantalla
      // cada segundo hace imposible leer el resto de la portada.
      aria-live="off"
      // Las cifras no bailan de ancho al cambiar de 1 a 2.
      sx={{ fontVariantNumeric: 'tabular-nums' }}
      {...other}
    >
      {!restante.terminado && !!prefijo && `${prefijo} `}
      {formatearCuenta(restante, textoFinal, formato)}
    </Box>
  );
}
