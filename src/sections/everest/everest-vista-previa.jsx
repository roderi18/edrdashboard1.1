'use client';

import { useRef, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
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
  tableta: { id: 'tableta', ancho: 768, etiqueta: 'Tableta', icono: 'solar:smartphone-2-bold' },
  escritorio: {
    id: 'escritorio',
    ancho: 1280,
    etiqueta: 'Escritorio',
    icono: 'solar:monitor-bold',
  },
});

const ALTO_MINIMO = 160;

export function EverestVistaPrevia({
  idBloque,
  contenido,
  diseno,
  seleccionado,
  onSeleccionar,
  onMover,
  sx,
}) {
  const marcoRef = useRef(null);
  const columnaRef = useRef(null);

  const [dispositivo, setDispositivo] = useState(DISPOSITIVOS.escritorio.id);
  const [anchoDisponible, setAnchoDisponible] = useState(0);
  const [alto, setAlto] = useState(ALTO_MINIMO);
  const [zoom, setZoom] = useState(null);

  const { ancho } = DISPOSITIVOS[dispositivo];
  // Nunca se agranda: solo se reduce lo que no cabe.
  const fraccionDelBloque = ['bienvenida'].includes(idBloque)
    ? 1
    : ['proximos-eventos', 'destacamento-destacado', 'comunicados', 'lema'].includes(idBloque)
      ? 1 / 3
      : 2 / 3;
  const escala =
    zoom ??
    (anchoDisponible ? Math.min(1, (anchoDisponible - 32) / (ancho * fraccionDelBloque)) : 1);

  const enviarContenido = useCallback(() => {
    marcoRef.current?.contentWindow?.postMessage(
      mensajeContenido(idBloque, contenido, diseno, seleccionado),
      window.location.origin
    );
  }, [contenido, diseno, idBloque, seleccionado]);

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
      if (mensaje?.tipo === TIPOS_DE_MENSAJE.seleccion) onSeleccionar?.(mensaje.seleccionado);
      if (mensaje?.tipo === TIPOS_DE_MENSAJE.mover) onMover?.(mensaje.movimiento);
    };

    window.addEventListener('message', alRecibir);

    return () => window.removeEventListener('message', alRecibir);
  }, [enviarContenido, onSeleccionar, onMover]);

  // Y cada cambio de contenido, al momento.
  useEffect(() => {
    enviarContenido();
  }, [enviarContenido]);

  return (
    <Card
      sx={[
        { p: 1.5, height: 1, minHeight: 0, display: 'flex', flexDirection: 'column' },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        spacing={1}
        sx={{ mb: 1.5, flexWrap: 'wrap' }}
      >
        <Typography variant="subtitle2">Lienzo · {idBloque?.replaceAll('-', ' ')}</Typography>

        <ToggleButtonGroup
          exclusive
          size="small"
          value={dispositivo}
          onChange={(evento, valor) => {
            if (valor) {
              setDispositivo(valor);
              setZoom(null);
            }
          }}
          aria-label="Tamaño de la vista previa"
        >
          {Object.values(DISPOSITIVOS).map((opcion) => (
            <ToggleButton key={opcion.id} value={opcion.id} aria-label={opcion.etiqueta}>
              <Iconify icon={opcion.icono} width={18} sx={{ mr: 0.75 }} />
              {opcion.etiqueta}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        <Stack direction="row" alignItems="center" spacing={0.25}>
          <IconButton
            size="small"
            aria-label="Reducir zoom"
            onClick={() => setZoom(Math.max(0.25, Number((escala - 0.1).toFixed(2))))}
          >
            <Iconify icon="eva:minus-circle-fill" width={18} />
          </IconButton>
          <Typography variant="caption" sx={{ minWidth: 38, textAlign: 'center' }}>
            {Math.round(escala * 100)}%
          </Typography>
          <IconButton
            size="small"
            aria-label="Aumentar zoom"
            onClick={() => setZoom(Math.min(1.5, Number((escala + 0.1).toFixed(2))))}
          >
            <Iconify icon="solar:add-circle-bold" width={18} />
          </IconButton>
          <Button size="small" onClick={() => setZoom(null)}>
            Ajustar
          </Button>
        </Stack>
      </Stack>

      <Box
        ref={columnaRef}
        sx={{
          overflowY: 'auto',
          overflowX: zoom === null ? 'hidden' : 'auto',
          borderRadius: 1.5,
          bgcolor: 'background.neutral',
          display: 'block',
          flex: 1,
          minHeight: 0,
          textAlign: 'center',
          // Lo que ocupa de verdad el marco reducido, para que no quede un hueco
          // debajo del tamaño sin reducir.
        }}
      >
        <Box
          sx={{
            width: ancho * fraccionDelBloque * escala + 16 * escala,
            height: alto * escala,
            mx: 'auto',
            my: 2,
            position: 'relative',
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
              position: 'absolute',
              top: 0,
              left: 0,
              transform: `scale(${escala})`,
              transformOrigin: 'top left',
              // Es para mirar: los enlaces y botones de las tarjetas no llevan a
              // ningun sitio desde aqui.
              pointerEvents: 'auto',
            }}
          />
        </Box>
      </Box>
    </Card>
  );
}
