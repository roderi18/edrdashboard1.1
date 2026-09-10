'use client';

import { useRef, useState } from 'react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Slider from '@mui/material/Slider';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Popover from '@mui/material/Popover';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import InputAdornment from '@mui/material/InputAdornment';

import {
  EFECTOS,
  LIMITES,
  efectoACss,
  elementoACss,
  sanearElemento,
} from 'src/utils/store-header-design.mjs';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------
// EL TEXTO PARPADEANTE, ELEGIDO VIENDOLO.
//
// Cinco efectos con nombre no dicen nada: "pulso suave" y "colores en vertical"
// solo se distinguen mirandolos. Por eso cada opcion es una MUESTRA VIVA, con
// el texto, los colores y la velocidad que se estan configurando —no un rotulo
// de ejemplo—, y todas laten a la vez para poder compararlas.
//
// Las muestras se pintan con `efectoACss` y `elementoACss`, las mismas
// funciones que usa el encabezado. Si la muestra se dibujara aparte, elegir por
// ella seria elegir a ciegas.
// ----------------------------------------------------------------------

// Los emojis que se usan en una tienda. No es un teclado completo a proposito:
// el campo acepta CUALQUIER emoji del sistema —se pega, o se escribe con el
// teclado del movil—, y esto es el atajo para los de siempre.
const EMOJIS = ['🎉', '🔥', '⭐', '✨', '🎁', '🛒', '💥', '❤️', '👏', '🚀', '🏕️', '🧭', '💸', '⏰'];

const PROPUESTA = {
  tipo: 'texto',
  texto: '¡Oferta! 🔥',
  tamano: 20,
  ancho: 34,
  x: 62,
  y: 12,
  color: '#FFAB00',
  colorSecundario: '#FF5630',
  negrita: true,
  efecto: 'parpadeo',
  velocidad: 1.1,
};

export function TextoParpadeanteDialogo({ abierto, paleta, onCancelar, onAgregar }) {
  const [borrador, setBorrador] = useState(PROPUESTA);
  const [anclaEmojis, setAnclaEmojis] = useState(null);
  const campoRef = useRef(null);

  const cambiar = (cambios) => setBorrador((actual) => sanearElemento({ ...actual, ...cambios }));

  // Se inserta DONDE ESTA EL CURSOR, no al final: un emoji en mitad de la frase
  // es lo normal ("¡Oferta 🔥 del mes!"), y pegarlo siempre al final obliga a
  // recolocarlo a mano.
  const insertarEmoji = (emoji) => {
    const campo = campoRef.current;
    const posicion = campo?.selectionStart ?? borrador.texto.length;
    const antes = borrador.texto.slice(0, posicion);
    const despues = borrador.texto.slice(posicion);

    cambiar({ texto: `${antes}${emoji}${despues}` });
    setAnclaEmojis(null);

    // El cursor se queda detras del emoji, listo para seguir escribiendo.
    requestAnimationFrame(() => {
      const siguiente = antes.length + emoji.length;

      campo?.focus();
      campo?.setSelectionRange?.(siguiente, siguiente);
    });
  };

  const cerrar = () => {
    setBorrador(PROPUESTA);
    onCancelar?.();
  };

  const renderMuestra = (efecto) => {
    const muestra = sanearElemento({ ...borrador, efecto: efecto.id });
    const elegido = borrador.efecto === efecto.id;
    const estilos = elementoACss(muestra);

    return (
      <Box
        key={efecto.id}
        component="button"
        type="button"
        onClick={() => cambiar({ efecto: efecto.id })}
        aria-pressed={elegido}
        sx={{
          p: 1.5,
          width: 1,
          minHeight: 74,
          cursor: 'pointer',
          textAlign: 'left',
          borderRadius: 1.5,
          bgcolor: 'common.black',
          border: (theme) =>
            elegido
              ? `2px solid ${theme.vars.palette.primary.main}`
              : `1px solid ${theme.vars.palette.divider}`,
        }}
      >
        <Typography variant="caption" sx={{ color: 'text.disabled', display: 'block', mb: 0.5 }}>
          {efecto.etiqueta}
        </Typography>

        <Box
          sx={{
            // La muestra no se coloca en ningun sitio: se le quitan las
            // coordenadas y se queda el aspecto, que es lo que se compara.
            ...estilos,
            left: 'auto',
            top: 'auto',
            width: 'auto',
            display: 'inline-block',
            lineHeight: 1.3,
            ...efectoACss(muestra),
          }}
        >
          {muestra.texto}
        </Box>
      </Box>
    );
  };

  return (
    <Dialog fullWidth maxWidth="sm" open={!!abierto} onClose={cerrar}>
      <DialogTitle>Texto parpadeante</DialogTitle>

      <DialogContent dividers>
        {/* EL AIRE DE ARRIBA NO ES DECORACION. La etiqueta flotante del primer
            campo se dibuja POR ENCIMA de su borde, y pegada al techo del
            dialogo la recortaba el desplazamiento: se leia "exto". */}
        <Stack spacing={2.5} sx={{ pt: 1 }}>
          <TextField
            fullWidth
            size="small"
            label="Texto"
            inputRef={campoRef}
            value={borrador.texto}
            onChange={(event) => cambiar({ texto: event.target.value })}
            slotProps={{
              htmlInput: { maxLength: LIMITES.texto },
              input: {
                // EL EMOJI SE PONE DONDE SE ESCRIBE. Una fila de emojis debajo
                // del campo obliga a mirar a otro sitio para algo que forma
                // parte del texto; aqui esta a la derecha de lo que se escribe.
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      edge="end"
                      aria-label="Agregar un emoji"
                      onClick={(event) => setAnclaEmojis(event.currentTarget)}
                    >
                      <Iconify icon="solar:smile-circle-bold" />
                    </IconButton>
                  </InputAdornment>
                ),
              },
            }}
          />

          <Popover
            open={!!anclaEmojis}
            anchorEl={anclaEmojis}
            onClose={() => setAnclaEmojis(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          >
            <Box
              sx={{
                p: 1,
                gap: 0.5,
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
              }}
            >
              {EMOJIS.map((emoji) => (
                <Box
                  key={emoji}
                  component="button"
                  type="button"
                  aria-label={`Agregar ${emoji}`}
                  onClick={() => insertarEmoji(emoji)}
                  sx={{
                    p: 0.75,
                    fontSize: 18,
                    lineHeight: 1,
                    border: 'none',
                    cursor: 'pointer',
                    borderRadius: 1,
                    bgcolor: 'transparent',
                    '&:hover': { bgcolor: 'action.hover' },
                  }}
                >
                  {emoji}
                </Box>
              ))}
            </Box>
          </Popover>

          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Efecto
            </Typography>

            <Box
              sx={{
                gap: 1,
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
              }}
            >
              {EFECTOS.filter((efecto) => efecto.id !== 'ninguno').map(renderMuestra)}
            </Box>
          </Box>

          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
              Color principal
            </Typography>

            {paleta(borrador.color, (color) => cambiar({ color }))}
          </Box>

          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
              Segundo color (para los efectos de color)
            </Typography>

            {paleta(borrador.colorSecundario, (colorSecundario) => cambiar({ colorSecundario }))}
          </Box>

          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Velocidad (segundos por ciclo)
            </Typography>

            <Slider
              size="small"
              step={0.1}
              min={LIMITES.velocidad.min}
              max={LIMITES.velocidad.max}
              value={borrador.velocidad}
              valueLabelDisplay="auto"
              onChange={(_, valor) => cambiar({ velocidad: valor })}
            />
          </Box>

          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Tamaño
            </Typography>

            <Slider
              size="small"
              min={LIMITES.tamano.min}
              max={LIMITES.tamano.max}
              value={borrador.tamano}
              valueLabelDisplay="auto"
              onChange={(_, valor) => cambiar({ tamano: valor })}
            />
          </Box>

          <Typography variant="caption" sx={{ color: 'text.disabled' }}>
            El movimiento se detiene para quien pidió menos animación en su sistema: el texto y los
            colores se quedan, quietos y legibles.
          </Typography>
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button color="inherit" onClick={cerrar}>
          Cancelar
        </Button>

        <Button
          variant="contained"
          onClick={() => {
            onAgregar?.(borrador);
            setBorrador(PROPUESTA);
          }}
        >
          Agregar al encabezado
        </Button>
      </DialogActions>
    </Dialog>
  );
}
