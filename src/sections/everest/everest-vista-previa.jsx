'use client';

import { useRef, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

import { paths } from 'src/routes/paths';

import {
  mensajeValido,
  mensajeContenido,
  TIPOS_DE_MENSAJE,
  FUENTE_VISTA_PREVIA,
} from 'src/utils/everest/mensajes-vista-previa.mjs';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------
// LA VISTA PREVIA, EN CELULAR O EN ESCRITORIO.
//
// Va en un iframe (ver `mensajes-vista-previa.mjs`): asi la portada cree que la
// ventana mide lo que mide el telefono o el monitor, y aplica sus estilos de
// verdad para ese ancho.
//
//   - CELULAR: 375 px, el ancho de referencia de un telefono corriente.
//   - ESCRITORIO: 1280 px, reducido a escala para que quepa en la columna. Se ve
//     mas pequeño, pero con la disposicion de un monitor: lado a lado lo que en
//     escritorio va lado a lado.
//
// El contenido se le manda por mensaje cada vez que cambia, asi que enseña lo que
// se esta escribiendo aunque todavia no se haya guardado.
// ----------------------------------------------------------------------

export const DISPOSITIVOS = Object.freeze({
  celular: { id: 'celular', ancho: 375, etiqueta: 'Celular', icono: 'solar:smartphone-2-bold' },
  escritorio: {
    id: 'escritorio',
    ancho: 1280,
    etiqueta: 'Escritorio',
    icono: 'solar:monitor-bold',
  },
});

const ALTO_MINIMO = 160;

export function EverestVistaPrevia({ idBloque, contenido, diseno, sx }) {
  const marcoRef = useRef(null);
  const columnaRef = useRef(null);

  const [dispositivo, setDispositivo] = useState(DISPOSITIVOS.escritorio.id);
  const [anchoDisponible, setAnchoDisponible] = useState(0);
  const [alto, setAlto] = useState(ALTO_MINIMO);

  const { ancho } = DISPOSITIVOS[dispositivo];
  // Nunca se agranda: solo se reduce lo que no cabe.
  const escala = anchoDisponible ? Math.min(1, anchoDisponible / ancho) : 1;

  const enviarContenido = useCallback(() => {
    marcoRef.current?.contentWindow?.postMessage(
      mensajeContenido(idBloque, contenido, diseno),
      window.location.origin
    );
  }, [contenido, diseno, idBloque]);

  // El ancho de la columna, para calcular la escala.
  useEffect(() => {
    const columna = columnaRef.current;

    if (!columna || typeof ResizeObserver === 'undefined') return undefined;

    const observador = new ResizeObserver(([entrada]) =>
      setAnchoDisponible(entrada.contentRect.width)
    );

    observador.observe(columna);

    return () => observador.disconnect();
  }, []);

  // Lo que dice la vista previa: que esta lista, y cuanto mide.
  useEffect(() => {
    const alRecibir = (evento) => {
      if (evento.source !== marcoRef.current?.contentWindow) return;

      const mensaje = mensajeValido(evento, window.location.origin, FUENTE_VISTA_PREVIA);

      if (mensaje?.tipo === TIPOS_DE_MENSAJE.lista) enviarContenido();
      if (mensaje?.tipo === TIPOS_DE_MENSAJE.alto) setAlto(Math.max(ALTO_MINIMO, mensaje.alto));
    };

    window.addEventListener('message', alRecibir);

    return () => window.removeEventListener('message', alRecibir);
  }, [enviarContenido]);

  // Y cada cambio de contenido, al momento.
  useEffect(() => {
    enviarContenido();
  }, [enviarContenido]);

  return (
    <Card sx={[{ p: 2 }, ...(Array.isArray(sx) ? sx : [sx])]}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="subtitle2">Vista previa</Typography>

        <ToggleButtonGroup
          exclusive
          size="small"
          value={dispositivo}
          onChange={(evento, valor) => valor && setDispositivo(valor)}
          aria-label="Tamaño de la vista previa"
        >
          {Object.values(DISPOSITIVOS).map((opcion) => (
            <ToggleButton key={opcion.id} value={opcion.id} aria-label={opcion.etiqueta}>
              <Iconify icon={opcion.icono} width={18} sx={{ mr: 0.75 }} />
              {opcion.etiqueta}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Stack>

      <Box
        ref={columnaRef}
        sx={{
          overflow: 'hidden',
          borderRadius: 1.5,
          bgcolor: 'background.neutral',
          display: 'flex',
          justifyContent: 'center',
          // Lo que ocupa de verdad el marco reducido, para que no quede un hueco
          // debajo del tamaño sin reducir.
          height: alto * escala,
        }}
      >
        <Box
          component="iframe"
          // Otro iframe al cambiar de tamaño: arranca de cero con el ancho nuevo y
          // vuelve a avisar de que esta listo.
          key={dispositivo}
          ref={marcoRef}
          title={`Vista previa de la portada en ${DISPOSITIVOS[dispositivo].etiqueta.toLowerCase()}`}
          src={paths.everestVistaPrevia}
          sx={{
            border: 0,
            width: ancho,
            height: alto,
            flexShrink: 0,
            transform: `scale(${escala})`,
            transformOrigin: 'top center',
            // Es para mirar: los enlaces y botones de las tarjetas no llevan a
            // ningun sitio desde aqui.
            pointerEvents: 'none',
          }}
        />
      </Box>
    </Card>
  );
}
