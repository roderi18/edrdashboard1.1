'use client';

import { useRef, useMemo, useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Popover from '@mui/material/Popover';
import InputBase from '@mui/material/InputBase';
import Typography from '@mui/material/Typography';
import InputAdornment from '@mui/material/InputAdornment';

import { buscarEmojis, CATEGORIAS_EMOJI } from 'src/catalogs/emojis.mjs';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------
// EL SELECTOR DE EMOJIS.
//
// Como en WhatsApp: se escribe lo que se busca y la rejilla se queda con lo que
// coincide. Antes solo habia categorias, y para dar con uno concreto —entre
// seiscientos— tocaba recorrerlos con la vista.
//
// Cada emoji lleva su nombre en español: al pasar por encima se ve abajo, que es
// donde no estorba, y es exactamente el texto por el que se busca. Asi lo que se
// lee y lo que se escribe son la misma cosa.
// ----------------------------------------------------------------------

const COLUMNAS = 8;

/**
 * El panel en si: buscador, categorias y rejilla.
 *
 * Se exporta aparte porque no siempre va dentro de un globo flotante: en las
 * reacciones de un mensaje se despliega ahi mismo, en linea.
 */
export function PanelDeEmojis({
  activo = true,
  onSelectEmoji,
  seleccionado = null,
  tamano = 38,
  ancho = null,
}) {
  const open = activo;
  const campo = useRef(null);
  const [busqueda, setBusqueda] = useState('');
  const [categoria, setCategoria] = useState(CATEGORIAS_EMOJI[0].id);
  const [encima, setEncima] = useState(null);

  // Se abre limpio: lo que se busco la vez anterior no tiene por que seguir
  // filtrando ahora. Y el cursor va al buscador, para poder escribir de una.
  useEffect(() => {
    if (!open) return undefined;

    setBusqueda('');
    setEncima(null);

    const enfocar = setTimeout(() => campo.current?.focus(), 60);

    return () => clearTimeout(enfocar);
  }, [open]);

  const buscando = busqueda.trim().length > 0;

  const visibles = useMemo(() => {
    if (buscando) return buscarEmojis(busqueda);

    const actual = CATEGORIAS_EMOJI.find((item) => item.id === categoria) ?? CATEGORIAS_EMOJI[0];

    return actual.emojis.map(([emoji, nombre]) => ({ emoji, nombre }));
  }, [buscando, busqueda, categoria]);

  const elegir = (emoji) => {
    onSelectEmoji?.(emoji);
  };

  return (
    <Box sx={{ p: 1, ...(ancho ? { width: ancho, maxWidth: 'calc(100vw - 40px)' } : null) }}>
      <InputBase
        inputRef={campo}
        value={busqueda}
        onChange={(evento) => setBusqueda(evento.target.value)}
        placeholder="Buscar emoji…"
        inputProps={{ 'aria-label': 'Buscar emoji' }}
        startAdornment={
          <InputAdornment position="start">
            <Iconify icon="eva:search-fill" width={18} sx={{ color: 'text.disabled' }} />
          </InputAdornment>
        }
        endAdornment={
          buscando ? (
            <InputAdornment position="end">
              <Box
                component="button"
                type="button"
                onClick={() => {
                  setBusqueda('');
                  campo.current?.focus();
                }}
                aria-label="Borrar la búsqueda"
                sx={{
                  p: 0.25,
                  border: 0,
                  display: 'flex',
                  borderRadius: '50%',
                  cursor: 'pointer',
                  color: 'text.disabled',
                  bgcolor: 'transparent',
                }}
              >
                <Iconify icon="mingcute:close-line" width={16} />
              </Box>
            </InputAdornment>
          ) : null
        }
        sx={(theme) => ({
          px: 1,
          mb: 1,
          width: 1,
          height: 36,
          borderRadius: 1,
          typography: 'body2',
          bgcolor: theme.vars.palette.background.neutral,
        })}
      />

      {/* Buscando no hacen falta: la busqueda ya cruza todas las categorias. */}
      {!buscando && (
        <Box sx={{ gap: 0.5, mb: 1, display: 'flex', overflowX: 'auto' }}>
          {CATEGORIAS_EMOJI.map((item) => (
            <Box
              key={item.id}
              component="button"
              type="button"
              title={item.nombre}
              onClick={() => setCategoria(item.id)}
              sx={{
                px: 1,
                py: 0.5,
                border: 0,
                borderRadius: 1,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                typography: 'caption',
                color: categoria === item.id ? 'primary.contrastText' : 'text.primary',
                bgcolor: categoria === item.id ? 'primary.main' : 'background.neutral',
              }}
            >
              {item.nombre}
            </Box>
          ))}
        </Box>
      )}

      <Box
        sx={{
          gap: 0.25,
          display: 'grid',
          height: 260,
          overflowY: 'auto',
          alignContent: 'start',
          gridTemplateColumns: `repeat(${COLUMNAS}, 1fr)`,
        }}
      >
        {visibles.map(({ emoji, nombre }, indice) => (
          <Box
            key={`${emoji}-${indice}`}
            component="button"
            type="button"
            title={nombre}
            aria-label={nombre}
            onClick={() => elegir(emoji)}
            onMouseEnter={() => setEncima(nombre)}
            onFocus={() => setEncima(nombre)}
            aria-pressed={seleccionado === emoji}
            sx={{
              p: 0,
              border: 0,
              lineHeight: 1,
              borderRadius: 1,
              cursor: 'pointer',
              width: tamano,
              height: tamano,
              fontSize: tamano * 0.58,
              bgcolor: seleccionado === emoji ? 'action.selected' : 'transparent',
              '&:hover, &:focus-visible': { bgcolor: 'action.hover' },
            }}
          >
            {emoji}
          </Box>
        ))}

        {!visibles.length && (
          <Typography
            variant="body2"
            sx={{
              py: 4,
              gridColumn: '1 / -1',
              textAlign: 'center',
              color: 'text.disabled',
            }}
          >
            Ningún emoji se llama así.
          </Typography>
        )}
      </Box>

      {/* El nombre del que se esta señalando. Ocupa sitio siempre, aunque este
          vacio: si apareciera y desapareciera, la rejilla daria saltos. */}
      <Typography
        noWrap
        variant="caption"
        sx={{
          pt: 0.75,
          height: 24,
          display: 'block',
          textAlign: 'center',
          color: 'text.secondary',
        }}
      >
        {encima ?? (buscando ? `${visibles.length} resultados` : '')}
      </Typography>
    </Box>
  );
}

// ----------------------------------------------------------------------

/** El mismo panel, dentro de un globo flotante. */
export function SelectorDeEmojis({ open, anchorEl, onClose, onSelectEmoji }) {
  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
      transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      slotProps={{
        paper: { sx: { width: 360, maxWidth: 'calc(100vw - 32px)', borderRadius: 1.5 } },
      }}
    >
      <PanelDeEmojis activo={open} onSelectEmoji={onSelectEmoji} />
    </Popover>
  );
}
