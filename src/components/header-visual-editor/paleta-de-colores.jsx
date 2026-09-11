'use client';

import { useRef, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Popover from '@mui/material/Popover';
import Tooltip from '@mui/material/Tooltip';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import { PALETA, SIN_COLOR, esSinColor, sanearColor } from 'src/utils/store-header-design.mjs';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------
// LOS COLORES QUE SE PUEDEN ELEGIR.
//
// Primero los dieciseis de la casa —los del tema, que es lo que se usa el 95%
// de las veces y de un vistazo—, despues la rueda completa para el caso raro
// pero real (el verde exacto de una marca, el color de una campaña), y al final
// la X de "aqui no quiero color".
//
// Ese orden no es casual: lo frecuente primero y lo excepcional despues. Con la
// rueda delante, cada cambio de color pedia abrir un flotante y elegir a mano
// un tono que ya estaba a un clic en la fila.
// ----------------------------------------------------------------------

const LADO = 22;

export function PaletaDeColores({ valor, onElegir }) {
  const [ancla, setAncla] = useState(null);
  const [codigo, setCodigo] = useState('');

  // ARRASTRAR EN LA RUEDA DISPARA DECENAS DE CAMBIOS POR SEGUNDO. Llevarlos
  // todos hasta el diseño repintaba el encabezado entero en cada pixel —y, peor,
  // apilaba una entrada de historial por pixel—: la bolita del selector iba a
  // tirones y despues hacian falta cien "deshacer" para volver atras.
  //
  // Lo que se ve —el codigo y la muestra— se actualiza AL INSTANTE, porque es
  // estado local y no cuesta nada. Lo que se guarda va como mucho una vez por
  // fotograma, y marcado como un solo gesto para que el historial lo funda.
  const pendiente = useRef(null);
  const fotograma = useRef(0);

  const propagar = useCallback(
    (color) => {
      pendiente.current = color;

      if (fotograma.current) return;

      fotograma.current = requestAnimationFrame(() => {
        fotograma.current = 0;
        onElegir(pendiente.current, 'color-continuo');
      });
    },
    [onElegir]
  );

  // Al soltar se cierra el gesto: el proximo cambio abre su propia entrada de
  // historial, y el color definitivo llega sin esperar al fotograma.
  const cerrar = useCallback(() => {
    if (fotograma.current) {
      cancelAnimationFrame(fotograma.current);
      fotograma.current = 0;
    }

    if (pendiente.current) onElegir(pendiente.current);

    pendiente.current = null;
    setAncla(null);
  }, [onElegir]);

  useEffect(
    () => () => {
      if (fotograma.current) cancelAnimationFrame(fotograma.current);
    },
    []
  );

  const abrir = (evento) => {
    setCodigo(esSinColor(valor) ? '#FFFFFF' : sanearColor(valor, '#FFFFFF'));
    setAncla(evento.currentTarget);
  };

  const elegirDelSelector = (color) => {
    setCodigo(color);
    propagar(sanearColor(color, '#FFFFFF'));
  };

  // El codigo escrito a mano solo se aplica cuando es un color de verdad: asi se
  // puede ir escribiendo "#1A2B3C" letra a letra sin que el texto parpadee de
  // color en cada pulsacion.
  const escribirCodigo = (texto) => {
    setCodigo(texto);

    const limpio = texto.trim().toUpperCase();

    if (/^#(?:[0-9A-F]{6}|[0-9A-F]{8})$/.test(limpio)) propagar(limpio);
  };

  const esDeLaCasa = PALETA.includes(String(valor ?? '').toUpperCase());
  const esPropio = !esDeLaCasa && !esSinColor(valor);

  const bordeDe = (elegido) => (theme) =>
    elegido
      ? `2px solid ${theme.vars.palette.primary.main}`
      : `1px solid ${theme.vars.palette.divider}`;

  return (
    <>
      <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.5 }}>
        {PALETA.map((color) => (
          <Box
            key={color}
            component="button"
            type="button"
            aria-label={`Color ${color}`}
            onClick={() => onElegir(color)}
            sx={{
              p: 0,
              width: LADO,
              height: LADO,
              cursor: 'pointer',
              borderRadius: '50%',
              bgcolor: color,
              border: bordeDe(String(valor ?? '').toUpperCase() === color),
            }}
          />
        ))}

        {/* LA RUEDA COMPLETA. Se pinta con los colores dando la vuelta para que
            se entienda sin leer nada; si ya hay un color propio elegido, la
            rueda lo enseña en vez del arcoiris. */}
        <Tooltip title="Otro color…">
          <Box
            component="button"
            type="button"
            aria-label="Elegir otro color"
            onClick={abrir}
            sx={{
              p: 0,
              width: LADO,
              height: LADO,
              cursor: 'pointer',
              borderRadius: '50%',
              border: bordeDe(esPropio),
              ...(esPropio
                ? { bgcolor: valor }
                : {
                    backgroundImage:
                      'conic-gradient(#FF5630, #FFAB00, #00A76F, #00B8D9, #8E33FF, #FF5630)',
                  }),
            }}
          />
        </Tooltip>

        {/* Y LA X, AL FINAL: "aqui no quiero color". Hace falta de verdad —un
            degradado que se desvanece, una forma que solo es su sombra—, y sin
            ella habia que elegir a la fuerza uno de los dieciseis, donde el mas
            parecido a "nada" seguia siendo algo. */}
        <Tooltip title="Sin color">
          <Box
            component="button"
            type="button"
            aria-label="Sin color"
            onClick={() => onElegir(SIN_COLOR)}
            sx={{
              p: 0,
              width: LADO,
              height: LADO,
              display: 'flex',
              cursor: 'pointer',
              alignItems: 'center',
              borderRadius: '50%',
              justifyContent: 'center',
              color: 'text.disabled',
              bgcolor: 'transparent',
              border: (theme) =>
                esSinColor(valor)
                  ? `2px solid ${theme.vars.palette.primary.main}`
                  : `1px dashed ${theme.vars.palette.divider}`,
            }}
          >
            <Iconify icon="eva:close-fill" width={14} />
          </Box>
        </Tooltip>
      </Stack>

      <Popover
        open={!!ancla}
        anchorEl={ancla}
        onClose={cerrar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Stack spacing={2} sx={{ p: 2, width: 240 }}>
          <Typography variant="subtitle2">Otro color</Typography>

          {/* La rueda del sistema: la misma que la persona ya sabe usar en
              cualquier otro programa, con cuentagotas incluido donde lo haya. */}
          <Box
            component="input"
            type="color"
            value={esSinColor(codigo) ? '#FFFFFF' : codigo.slice(0, 7)}
            onChange={(evento) => elegirDelSelector(evento.target.value.toUpperCase())}
            // Al soltar el raton, el color definitivo y el cierre del gesto.
            onBlur={() => onElegir(sanearColor(codigo, '#FFFFFF'))}
            sx={{
              p: 0,
              width: 1,
              height: 44,
              border: 'none',
              cursor: 'pointer',
              borderRadius: 1,
              bgcolor: 'transparent',
            }}
          />

          <TextField
            size="small"
            label="Código"
            value={codigo}
            placeholder="#00A76F"
            onChange={(evento) => escribirCodigo(evento.target.value)}
            helperText="Hexadecimal, con # delante."
          />

          <Button size="small" color="inherit" onClick={cerrar}>
            Listo
          </Button>
        </Stack>
      </Popover>
    </>
  );
}
