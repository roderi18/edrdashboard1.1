'use client';

import { m } from 'framer-motion';
import { useState, useEffect, useCallback } from 'react';

import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import { useColorScheme } from '@mui/material/styles';

import { Iconify } from 'src/components/iconify';
import { useSettingsContext } from 'src/components/settings';
import { varTap, varHover, transitionTap } from 'src/components/animate';

// ----------------------------------------------------------------------
// ACLARAR Y OSCURECER SIN ABRIR NADA.
//
// El interruptor de tres estados vive dentro del panel de Ajustes, detras del
// engranaje: para cambiar de tema habia que abrir el cajon, buscar la tarjeta y
// cerrarlo. Este boton hace lo mismo de un toque y va justo al lado, de modo que
// esta en todas las pantallas donde esta el engranaje —incluido el inicio de
// sesion, antes de tener cuenta—.
//
// Aqui solo hay dos caras, claro y oscuro, porque es lo que se pide de un toque.
// Volver a "Sistema" —que el telefono mande— sigue estando en Ajustes.
// ----------------------------------------------------------------------

export function ThemeModeButton({ sx, ...other }) {
  const settings = useSettingsContext();
  const { mode, setMode, colorScheme } = useColorScheme();

  // El servidor no sabe que tema toca —lo resuelve el navegador antes de pintar—
  // y dibujar aqui una suposicion desencaja la hidratacion. Hasta entonces, el
  // boton ocupa su sitio sin icono.
  const [montado, setMontado] = useState(false);

  useEffect(() => {
    setMontado(true);
  }, []);

  const esOscuro = colorScheme === 'dark';

  const alternar = useCallback(() => {
    const siguiente = esOscuro ? 'light' : 'dark';

    setMode(siguiente);
    settings.setState({ mode: siguiente });
  }, [esOscuro, setMode, settings]);

  // El icono ensena A DONDE SE VA, no donde se esta: en oscuro se ofrece el sol.
  const icono = esOscuro ? 'solar:sun-bold-duotone' : 'solar:moon-bold-duotone';
  const titulo = esOscuro ? 'Modo claro' : 'Modo oscuro';
  // Mientras el tema lo decide el telefono, conviene decirlo: al pulsar se fija
  // a mano y deja de seguirlo.
  const siguiendoAlSistema = montado && (mode === 'system' || mode === undefined);

  return (
    <Tooltip title={siguiendoAlSistema ? `${titulo} (ahora sigue al sistema)` : titulo}>
      <IconButton
        component={m.button}
        whileTap={varTap(0.96)}
        whileHover={varHover(1.04)}
        transition={transitionTap()}
        aria-label={titulo}
        onClick={alternar}
        sx={[{ p: 0, width: 40, height: 40 }, ...(Array.isArray(sx) ? sx : [sx])]}
        {...other}
      >
        {montado && <Iconify width={24} icon={icono} />}
      </IconButton>
    </Tooltip>
  );
}
