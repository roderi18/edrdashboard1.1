'use client';

import { createPortal } from 'react-dom';
import { varAlpha } from 'minimal-shared/utils';
import { useRef, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import { useColorScheme } from '@mui/material/styles';

import { Fogata } from './ilustraciones-campamento';

// ----------------------------------------------------------------------
// «EXPLORAR DE NOCHE» (solo en el modo oscuro): una antorcha sigue al cursor
// (o al dedo) y aclara solo esa parte, sin oscurecer lo demás, con una luz que parpadea como
// una llama. Es un juego opcional: nunca se enciende sola, no tapa clics (la
// capa deja pasar el puntero) y se apaga con el mismo botón o con Esc. Quien
// pide menos movimiento en su sistema ve la luz quieta.
// ----------------------------------------------------------------------

const RADIO = 170;

function Luz({ onApagar }) {
  const capa = useRef(null);
  const antorcha = useRef(null);

  useEffect(() => {
    let x = window.innerWidth / 2;
    let y = window.innerHeight / 2;
    let cuadro = 0;
    const pintar = () => {
      cuadro = 0;
      capa.current?.style.setProperty('--x', `${x}px`);
      capa.current?.style.setProperty('--y', `${y}px`);
      if (antorcha.current)
        antorcha.current.style.transform = `translate(${x - 30}px, ${y - 44}px)`;
    };
    const mover = (e) => {
      x = e.clientX;
      y = e.clientY;
      if (!cuadro) cuadro = requestAnimationFrame(pintar);
    };
    const tecla = (e) => e.key === 'Escape' && onApagar();
    pintar();
    window.addEventListener('pointermove', mover, { passive: true });
    window.addEventListener('pointerdown', mover, { passive: true });
    window.addEventListener('keydown', tecla);
    return () => {
      cancelAnimationFrame(cuadro);
      window.removeEventListener('pointermove', mover);
      window.removeEventListener('pointerdown', mover);
      window.removeEventListener('keydown', tecla);
    };
  }, [onApagar]);

  return createPortal(
    <Box
      ref={capa}
      aria-hidden
      sx={(t) => ({
        inset: 0,
        position: 'fixed',
        zIndex: t.zIndex.modal + 10,
        pointerEvents: 'none',
        '--r': `${RADIO}px`,
        // Solo la luz: un círculo cálido donde está la antorcha que aclara esa
        // parte (se suma a lo de debajo con `screen`); el resto queda como está.
        mixBlendMode: 'screen',
        background: `radial-gradient(circle var(--r) at var(--x) var(--y), ${varAlpha(t.vars.palette.brand.oroLightChannel, 0.45)} 0%, ${varAlpha(t.vars.palette.warning.mainChannel, 0.18)} 50%, transparent 100%)`,
        animation: 'llamaParpadea 0.9s ease-in-out infinite alternate',
        '@property --r': { syntax: "'<length>'", inherits: 'false', initialValue: '170px' },
        '@keyframes llamaParpadea': {
          '0%': { '--r': `${RADIO}px` },
          '30%': { '--r': `${RADIO + 14}px` },
          '60%': { '--r': `${RADIO - 8}px` },
          '100%': { '--r': `${RADIO + 8}px` },
        },
        '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
      })}
    >
      <Box ref={antorcha} sx={{ position: 'absolute', top: 0, left: 0, willChange: 'transform' }}>
        <Fogata tamano={60} />
      </Box>
    </Box>,
    document.body
  );
}

export function BotonExplorarDeNoche() {
  const [encendida, setEncendida] = useState(false);
  const apagar = useCallback(() => setEncendida(false), []);
  // Solo de noche: en el modo claro no tiene sentido una antorcha.
  const { colorScheme } = useColorScheme();
  const deNoche = colorScheme === 'dark';
  useEffect(() => {
    if (!deNoche) setEncendida(false);
  }, [deNoche]);
  if (!deNoche) return null;
  return (
    <>
      <Tooltip
        title={encendida ? 'Apagar la antorcha (Esc)' : 'Recorre la página con una antorcha'}
      >
        <Button
          size="small"
          variant="outlined"
          color="inherit"
          onClick={() => setEncendida((v) => !v)}
          sx={(t) => ({
            gap: 0.75,
            whiteSpace: 'nowrap',
            // Fuera en celulares (y en pantallas táctiles): la antorcha sigue al
            // cursor, y con el dedo estorba más de lo que juega.
            display: { xs: 'none', md: 'inline-flex' },
            '@media (hover: none)': { display: 'none' },
            borderColor: varAlpha(t.vars.palette.common.whiteChannel, 0.3),
            bgcolor: encendida ? varAlpha(t.vars.palette.warning.mainChannel, 0.25) : 'transparent',
          })}
        >
          <Box component="span" aria-hidden>
            🔥
          </Box>
          <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
            {encendida ? 'Apagar antorcha' : 'Explorar de noche'}
          </Box>
        </Button>
      </Tooltip>
      {encendida && <Luz onApagar={apagar} />}
    </>
  );
}
