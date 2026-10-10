import { useRef, useState, useEffect, useLayoutEffect } from 'react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------
// VISOR DEL CERTIFICADO: zoom y cuadrícula encima del lienzo.
//
// El zoom ensancha la caja del lienzo, no la escala con `transform`: el lienzo
// mide todo en % y en `cqw`, así que crece entero (letra incluida) y el ratón
// sigue cayendo donde se ve (con `scale` las posiciones del arrastre se
// desviaban). Ctrl + rueda (o pellizcar en el panel táctil) acerca hacia el
// punto del puntero. Ctrl + clic y arrastrar mueve la vista.
// ----------------------------------------------------------------------

const ZOOM_MINIMO = 0.5;
const ZOOM_MAXIMO = 4;
const PASOS = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4];

const acotarZoom = (valor) => Math.min(ZOOM_MAXIMO, Math.max(ZOOM_MINIMO, valor));

export function VisorOnerrd({ cuadricula, onCuadricula, mostrarCuadricula, children }) {
  const visorRef = useRef(null);
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(1);
  // Punto que tiene que quedarse bajo el puntero tras cambiar el zoom.
  const anclaRef = useRef(null);

  const cambiarZoom = (nuevo, ancla) => {
    const valor = Math.round(acotarZoom(nuevo) * 100) / 100;
    if (valor === zoomRef.current) return;
    const visor = visorRef.current;
    if (visor) {
      const rect = visor.getBoundingClientRect();
      // Sin puntero (botones), se acerca hacia el centro de lo que se ve.
      const x = ancla ? ancla.x - rect.left : rect.width / 2;
      const y = ancla ? ancla.y - rect.top : rect.height / 2;
      anclaRef.current = {
        x,
        y,
        contenidoX: (visor.scrollLeft + x) / zoomRef.current,
        contenidoY: (visor.scrollTop + y) / zoomRef.current,
      };
    }
    zoomRef.current = valor;
    setZoom(valor);
  };

  useLayoutEffect(() => {
    const visor = visorRef.current;
    const ancla = anclaRef.current;
    if (!visor || !ancla) return;
    anclaRef.current = null;
    visor.scrollLeft = ancla.contenidoX * zoom - ancla.x;
    visor.scrollTop = ancla.contenidoY * zoom - ancla.y;
  }, [zoom]);

  // La rueda con Ctrl haría zoom a toda la página: hay que poder cancelarla,
  // y React registra `onWheel` como pasivo.
  useEffect(() => {
    const visor = visorRef.current;
    if (!visor) return undefined;
    const alGirar = (evento) => {
      if (!evento.ctrlKey && !evento.metaKey) return;
      evento.preventDefault();
      const factor = Math.exp(-evento.deltaY * 0.002);
      cambiarZoom(zoomRef.current * factor, { x: evento.clientX, y: evento.clientY });
    };
    visor.addEventListener('wheel', alGirar, { passive: false });
    return () => visor.removeEventListener('wheel', alGirar);
  }, []);

  // Ctrl (⌘ en Mac) pulsado: la mano que arrastra el certificado. Se avisa con
  // el cursor antes de hacer clic.
  const [mano, setMano] = useState(false);
  const [arrastrando, setArrastrando] = useState(false);

  useEffect(() => {
    const alTeclear = (evento) => setMano(evento.ctrlKey || evento.metaKey);
    const alSalir = () => setMano(false);
    window.addEventListener('keydown', alTeclear);
    window.addEventListener('keyup', alTeclear);
    window.addEventListener('blur', alSalir);
    return () => {
      window.removeEventListener('keydown', alTeclear);
      window.removeEventListener('keyup', alTeclear);
      window.removeEventListener('blur', alSalir);
    };
  }, []);

  // Ctrl + clic y arrastrar mueve la vista, no el elemento: se atrapa en la
  // fase de captura para que el lienzo no llegue a elegir ni a arrastrar nada.
  // Sobre un elemento (al editar), Ctrl + clic lo suma a los elegidos: eso lo
  // hace el lienzo; la vista se mueve con Ctrl + arrastrar en lo vacío.
  const empezarAMoverLaVista = (evento) => {
    const visor = visorRef.current;
    if (!visor || evento.button > 0 || !(evento.ctrlKey || evento.metaKey)) return;
    if (mostrarCuadricula && evento.target.closest?.('[data-elemento-onerrd]')) return;
    evento.preventDefault();
    evento.stopPropagation();
    const inicio = {
      x: evento.clientX,
      y: evento.clientY,
      izquierda: visor.scrollLeft,
      arriba: visor.scrollTop,
    };
    setArrastrando(true);
    const mover = (ev) => {
      visor.scrollLeft = inicio.izquierda - (ev.clientX - inicio.x);
      visor.scrollTop = inicio.arriba - (ev.clientY - inicio.y);
    };
    const soltar = () => {
      setArrastrando(false);
      window.removeEventListener('pointermove', mover);
      window.removeEventListener('pointerup', soltar);
      window.removeEventListener('pointercancel', soltar);
    };
    window.addEventListener('pointermove', mover);
    window.addEventListener('pointerup', soltar);
    window.addEventListener('pointercancel', soltar);
  };

  const siguiente = (direccion) => {
    const actual = zoomRef.current;
    const paso =
      direccion > 0
        ? PASOS.find((p) => p > actual + 0.001)
        : [...PASOS].reverse().find((p) => p < actual - 0.001);
    cambiarZoom(paso ?? actual);
  };

  return (
    <>
      <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 1 }}>
        {mostrarCuadricula && (
          <Button
            size="small"
            color={cuadricula ? 'primary' : 'inherit'}
            variant={cuadricula ? 'soft' : 'text'}
            startIcon={<Iconify icon="mingcute:dot-grid-fill" />}
            onClick={() => onCuadricula(!cuadricula)}
          >
            Cuadrícula
          </Button>
        )}
        <Box sx={{ flex: 1 }} />
        <Box
          component="span"
          sx={{
            typography: 'caption',
            color: 'text.secondary',
            mr: 1,
            display: { xs: 'none', sm: 'inline' },
          }}
        >
          Ctrl + rueda: zoom · Ctrl + arrastrar: mover · Ctrl + clic: elegir varios
        </Box>
        <Tooltip title="Alejar (Ctrl + rueda)">
          <span>
            <IconButton size="small" disabled={zoom <= ZOOM_MINIMO} onClick={() => siguiente(-1)}>
              <Iconify icon="mingcute:minimize-line" width={18} />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Ajustar al ancho">
          <Button
            size="small"
            color="inherit"
            onClick={() => cambiarZoom(1)}
            sx={{ minWidth: 56, fontVariantNumeric: 'tabular-nums' }}
          >
            {Math.round(zoom * 100)}%
          </Button>
        </Tooltip>
        <Tooltip title="Acercar (Ctrl + rueda)">
          <span>
            <IconButton size="small" disabled={zoom >= ZOOM_MAXIMO} onClick={() => siguiente(1)}>
              <Iconify icon="mingcute:add-line" width={18} />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>

      <Box
        ref={visorRef}
        onPointerDownCapture={empezarAMoverLaVista}
        // Sin esto, el clic que cierra el arrastre llegaba al lienzo y
        // deseleccionaba (o en Mac, Ctrl + clic abría el menú contextual).
        onClickCapture={(evento) => (evento.ctrlKey || evento.metaKey) && evento.stopPropagation()}
        onContextMenu={(evento) => evento.ctrlKey && evento.preventDefault()}
        sx={{
          ...((mano || arrastrando) && {
            cursor: arrastrando ? 'grabbing' : 'grab',
            // El cursor de la mano manda sobre los de los elementos.
            '& *': { cursor: 'inherit !important' },
          }),
          overflow: zoom > 1 ? 'auto' : 'visible',
          // Con zoom el certificado no puede crecer sin fin hacia abajo: se
          // recorre dentro del visor, con las barras o la rueda.
          maxHeight: zoom > 1 ? '75vh' : 'none',
          borderRadius: 1,
        }}
      >
        <Box sx={{ width: `${zoom * 100}%`, mx: 'auto' }}>{children}</Box>
      </Box>
    </>
  );
}
