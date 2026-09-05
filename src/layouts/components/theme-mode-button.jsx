'use client';

import { m, useReducedMotion } from 'framer-motion';
import { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
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
// cerrarlo. Este boton hace lo mismo de un toque y va justo al lado, en las
// pantallas de acceso —antes de tener cuenta—.
//
// Aqui solo hay dos caras, claro y oscuro, porque es lo que se pide de un toque.
// Volver a "Sistema" —que el telefono mande— sigue estando en Ajustes.
//
// EL CAMBIO DE ICONO SE FUNDE, NO SALTA.
//
// Los dos iconos estan SIEMPRE puestos, uno encima del otro, y lo unico que
// cambia es cual se ve: el sol sube mientras la luna baja. Se montan los dos de
// entrada en vez de intercambiarlos porque un icono que entra y sale tiene que
// terminar de irse antes de desaparecer, y basta con que esa salida se quede a
// medias para dejar el boton en blanco.
//
// Y se anima con framer-motion, no con una transicion CSS, a proposito: el tema
// se aplica con `disableTransitionOnChange`, que durante un instante pone
// `transition: none` en toda la pagina para que no parpadee al cambiar de color.
// Una transicion CSS del icono caeria justo dentro de esa ventana y no se veria.
// framer-motion escribe el estilo cuadro a cuadro, asi que esa regla no le afecta.
// ----------------------------------------------------------------------

const DURACION_DEL_FUNDIDO = 0.28;

// El icono ensena A DONDE SE VA, no donde se esta: con la pantalla oscura se
// ofrece el sol, y con la pantalla clara la luna.
const ICONOS = [
  { nombre: 'solar:sun-bold-duotone', visibleEnOscuro: true },
  { nombre: 'solar:moon-bold-duotone', visibleEnOscuro: false },
];

export function ThemeModeButton({ sx, ...other }) {
  const settings = useSettingsContext();
  const { mode, setMode, colorScheme } = useColorScheme();

  const esOscuro = colorScheme === 'dark';

  // Quien pide menos movimiento recibe el cambio de golpe, no un fundido lento.
  const sinMovimiento = useReducedMotion();
  const duracion = sinMovimiento ? 0 : DURACION_DEL_FUNDIDO;

  // El servidor no sabe que tema toca —lo resuelve el navegador antes de pintar—
  // y dibujar aqui una suposicion desencaja la hidratacion. Hasta entonces, el
  // boton ocupa su sitio sin icono.
  const [montado, setMontado] = useState(false);

  useEffect(() => {
    setMontado(true);
  }, []);

  const alternar = useCallback(() => {
    const siguiente = esOscuro ? 'light' : 'dark';

    setMode(siguiente);
    settings.setState({ mode: siguiente });
  }, [esOscuro, setMode, settings]);

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
        {/* Hueco fijo de 24: los dos iconos se superponen, asi que ninguno de los
            dos puede ocupar sitio en el flujo. */}
        <Box sx={{ position: 'relative', width: 24, height: 24 }}>
          {montado &&
            ICONOS.map(({ nombre, visibleEnOscuro }) => {
              const visible = esOscuro === visibleEnOscuro;

              return (
                <m.span
                  key={nombre}
                  // `initial={false}` para que al cargar la pagina el icono que
                  // toca ya este puesto: el fundido es para el cambio, no para
                  // la llegada.
                  initial={false}
                  animate={{ opacity: visible ? 1 : 0, scale: visible ? 1 : 0.7 }}
                  transition={{ duration: duracion, ease: 'easeInOut' }}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    // El icono apagado sigue ahi; que no se coma la pulsacion.
                    pointerEvents: 'none',
                  }}
                >
                  <Iconify width={24} icon={nombre} />
                </m.span>
              );
            })}
        </Box>
      </IconButton>
    </Tooltip>
  );
}
