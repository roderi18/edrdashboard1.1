'use client';

import { useMemo, useState } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import InputLabel from '@mui/material/InputLabel';
import FormControl from '@mui/material/FormControl';

import { fDopCurrency } from 'src/utils/format-number';
import { precioValido } from 'src/utils/precio-de-producto.mjs';
import { FUENTES_DEL_LIENZO } from 'src/utils/everest/lienzo.mjs';

import { actualizarPrecioProductoFirestore } from 'src/services/product-service';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';

import { useAuthContext } from 'src/auth/hooks';

import { CampoMedio } from './editores/campos';

const CONTROL = {
  '& .MuiInputBase-input': { py: 0.85, fontSize: 13 },
  '& .MuiInputLabel-root': { fontSize: 13 },
};

const nuevaCapa = (tipo) => ({
  id: `capa-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
  tipo,
  x: 15,
  y: 15,
  width: tipo === 'forma' ? 25 : 55,
  height: tipo === 'forma' ? 20 : 18,
  ...(tipo === 'texto' ? { texto: 'Nuevo texto' } : {}),
  ...(tipo === 'imagen' ? { src: '/marca/expedition-isotipo.webp' } : {}),
  estilo: {},
});

function CampoNumero({ etiqueta, valor, onCambiar, min, max, paso = 1 }) {
  return (
    <TextField
      size="small"
      type="number"
      label={etiqueta}
      value={valor ?? ''}
      onChange={(evento) => {
        if (evento.target.value === '') return onCambiar(undefined);
        const siguiente = Number(evento.target.value);
        if (Number.isFinite(siguiente) && siguiente >= min && siguiente <= max)
          onCambiar(siguiente);
        return undefined;
      }}
      slotProps={{ htmlInput: { min, max, step: paso } }}
      sx={CONTROL}
      fullWidth
    />
  );
}

function CampoColor({ etiqueta, valor, onCambiar }) {
  return (
    <Stack direction="row" spacing={0.75} alignItems="center">
      <Box
        component="input"
        type="color"
        aria-label={etiqueta}
        value={/^#[0-9a-f]{6}$/i.test(valor ?? '') ? valor : '#FFFFFF'}
        onChange={(evento) => onCambiar(evento.target.value.toUpperCase())}
        sx={{ width: 34, height: 34, p: 0, border: 0, bgcolor: 'transparent', cursor: 'pointer' }}
      />
      <TextField
        size="small"
        label={etiqueta}
        value={valor ?? ''}
        placeholder="#FFFFFF"
        onChange={(evento) => {
          if (evento.target.value === '') onCambiar(undefined);
          if (/^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i.test(evento.target.value)) {
            onCambiar(evento.target.value.toUpperCase());
          }
        }}
        sx={{ ...CONTROL, flex: 1 }}
      />
    </Stack>
  );
}

// EL PRECIO DE UN COMBO SE CAMBIA EN LA TIENDA. Es el mismo número que cobra el
// carrito: escribirlo aquí como texto dejaba la portada en RD$800 y el cobro en
// RD$3,500. Se guarda en el producto al momento (no espera a Publicar, como la
// ficha de la tienda) y la portada, "Inscribirme" y el carrito lo leen de ahí.
function PrecioDeLaTienda({ productoId, productoNombre, precio }) {
  const { user } = useAuthContext();
  const [valor, setValor] = useState(String(precio ?? ''));
  const [guardado, setGuardado] = useState(Number(precio) || 0);
  const [guardando, setGuardando] = useState(false);
  const nuevo = precioValido(valor);
  const cambia = nuevo !== null && nuevo !== guardado;

  const guardar = async () => {
    if (!cambia) return;

    setGuardando(true);
    try {
      await actualizarPrecioProductoFirestore(productoId, nuevo, user);
      setGuardado(nuevo);
      toast.success(`Precio cambiado en la tienda: ${fDopCurrency(nuevo)}.`);
    } catch (fallo) {
      toast.error(fallo?.message || 'No se pudo cambiar el precio.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Card variant="outlined" sx={{ p: 1.5, display: 'grid', gap: 1.25 }}>
      <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
        <Iconify icon="solar:wad-of-money-bold" width={18} sx={{ color: 'primary.main' }} />
        <Typography variant="subtitle2" noWrap>
          Precio en la tienda{productoNombre ? ` · ${productoNombre}` : ''}
        </Typography>
      </Stack>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        Es el que se cobra. Cambiarlo aquí lo cambia en la tienda, en Inscribirme y en el carrito al
        momento, sin publicar.
      </Typography>
      <Stack direction="row" spacing={1}>
        <TextField
          size="small"
          label="Precio (RD$)"
          value={valor}
          error={valor !== '' && nuevo === null}
          onChange={(evento) => setValor(evento.target.value)}
          onKeyDown={(evento) => {
            if (evento.key === 'Enter') guardar();
          }}
          slotProps={{ htmlInput: { inputMode: 'decimal' } }}
          sx={{ ...CONTROL, flex: 1 }}
        />
        <Button variant="contained" disabled={!cambia} loading={guardando} onClick={guardar}>
          Guardar
        </Button>
      </Stack>
    </Card>
  );
}

export function EditorVisualUniversal({
  idBloque,
  diseno = {},
  seleccionado,
  onCambiar,
  onSeleccionar,
}) {
  const capas = diseno.capasVisuales ?? [];
  const capa =
    seleccionado?.tipo === 'capa' ? capas.find((item) => item.id === seleccionado.id) : null;
  const estilo = useMemo(
    () => (capa ? (capa.estilo ?? {}) : (diseno.elementosVisuales?.[seleccionado?.id] ?? {})),
    [capa, diseno, seleccionado]
  );
  const admiteTexto = capa?.tipo === 'texto' || (!capa && Boolean(seleccionado?.texto));
  const esPrecio = !capa && Boolean(seleccionado?.productoId);

  const cambiarCapa = (id, cambios) =>
    onCambiar({
      ...diseno,
      capasVisuales: capas.map((item) => (item.id === id ? { ...item, ...cambios } : item)),
    });

  const cambiarEstilo = (campo, valor) => {
    if (!seleccionado) return;
    const nuevo = { ...estilo };
    if (valor === undefined) delete nuevo[campo];
    else nuevo[campo] = valor;

    if (capa) cambiarCapa(capa.id, { estilo: nuevo });
    else {
      const elementos = { ...(diseno.elementosVisuales ?? {}) };
      if (Object.keys(nuevo).length) elementos[seleccionado.id] = nuevo;
      else delete elementos[seleccionado.id];
      const siguiente = { ...diseno };
      if (Object.keys(elementos).length) siguiente.elementosVisuales = elementos;
      else delete siguiente.elementosVisuales;
      onCambiar(siguiente);
    }
  };

  const agregar = (tipo) => {
    const nueva = nuevaCapa(tipo);
    onCambiar({ ...diseno, capasVisuales: [...capas, nueva] });
    onSeleccionar({ tipo: 'capa', id: nueva.id, etiqueta: `Capa ${tipo}` });
  };

  const quitar = () => {
    if (!seleccionado) return;
    if (capa) {
      const restantes = capas.filter((item) => item.id !== capa.id);
      const nuevo = { ...diseno };
      if (restantes.length) nuevo.capasVisuales = restantes;
      else delete nuevo.capasVisuales;
      onCambiar(nuevo);
    } else {
      const elementos = { ...(diseno.elementosVisuales ?? {}) };
      delete elementos[seleccionado.id];
      const nuevo = { ...diseno };
      if (Object.keys(elementos).length) nuevo.elementosVisuales = elementos;
      else delete nuevo.elementosVisuales;
      onCambiar(nuevo);
    }
    onSeleccionar(null);
  };

  const duplicar = () => {
    if (!capa) return;
    const nueva = {
      ...capa,
      id: nuevaCapa(capa.tipo).id,
      x: Math.min(100, capa.x + 4),
      y: Math.min(100, capa.y + 4),
    };
    onCambiar({ ...diseno, capasVisuales: [...capas, nueva] });
    onSeleccionar({ tipo: 'capa', id: nueva.id, etiqueta: `Capa ${nueva.tipo}` });
  };

  return (
    <Stack spacing={1.25} sx={{ p: 1.5 }}>
      <Typography variant="subtitle2">Agregar al lienzo</Typography>
      <Stack direction="row" spacing={0.5}>
        <Button
          size="small"
          variant="outlined"
          onClick={() => agregar('texto')}
          startIcon={<Iconify icon="solar:file-text-bold" width={16} />}
        >
          Texto
        </Button>
        <Button
          size="small"
          variant="outlined"
          onClick={() => agregar('forma')}
          startIcon={<Iconify icon="solar:gallery-circle-outline" width={16} />}
        >
          Forma
        </Button>
        <Button
          size="small"
          variant="outlined"
          onClick={() => agregar('imagen')}
          startIcon={<Iconify icon="solar:gallery-wide-bold" width={16} />}
        >
          Imagen
        </Button>
      </Stack>

      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        Selecciona cualquier texto, botón o imagen en el lienzo para moverlo y ajustar sus
        propiedades.
      </Typography>

      {capas.length > 0 && (
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
          {capas.map((item, indice) => (
            <Button
              key={item.id}
              size="small"
              variant={capa?.id === item.id ? 'contained' : 'soft'}
              onClick={() =>
                onSeleccionar({ tipo: 'capa', id: item.id, etiqueta: `Capa ${item.tipo}` })
              }
            >
              {indice + 1}. {item.tipo}
            </Button>
          ))}
        </Box>
      )}

      {!seleccionado ? (
        <Card variant="outlined" sx={{ p: 2, textAlign: 'center', bgcolor: 'background.neutral' }}>
          <Typography variant="body2">Pulsa un elemento en la vista previa.</Typography>
        </Card>
      ) : (
        <>
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <Typography variant="subtitle2" noWrap sx={{ flex: 1 }}>
              {seleccionado.etiqueta || 'Elemento'}
            </Typography>
            {capa && (
              <IconButton size="small" aria-label="Duplicar capa" onClick={duplicar}>
                <Iconify icon="solar:copy-bold" width={17} />
              </IconButton>
            )}
            <IconButton size="small" aria-label="Restablecer elemento" onClick={quitar}>
              <Iconify icon="solar:trash-bin-trash-bold" width={17} />
            </IconButton>
          </Stack>

          {esPrecio && (
            <PrecioDeLaTienda
              key={seleccionado.productoId}
              productoId={seleccionado.productoId}
              productoNombre={seleccionado.productoNombre}
              precio={seleccionado.precio}
            />
          )}

          {admiteTexto && !esPrecio && (
            <TextField
              label="Texto"
              size="small"
              multiline
              minRows={2}
              value={capa ? capa.texto : (estilo.texto ?? seleccionado.texto)}
              onChange={(evento) =>
                capa
                  ? cambiarCapa(capa.id, { texto: evento.target.value.slice(0, 500) })
                  : cambiarEstilo('texto', evento.target.value.slice(0, 500))
              }
              fullWidth
            />
          )}

          {capa?.tipo === 'imagen' && (
            <>
              <CampoMedio
                idBloque={idBloque}
                etiqueta="Imagen"
                valor={{ tipo: 'imagen', url: capa.src }}
                onCambiar={(medio) =>
                  cambiarCapa(capa.id, { src: medio?.url ?? '/marca/expedition-isotipo.webp' })
                }
                compacto
              />
              <TextField
                label="URL de la imagen"
                size="small"
                value={capa.src}
                onChange={(evento) => cambiarCapa(capa.id, { src: evento.target.value })}
                fullWidth
                sx={CONTROL}
              />
            </>
          )}

          {capa?.tipo !== 'imagen' && (
            <Typography variant="caption" sx={{ fontWeight: 700 }}>
              {admiteTexto ? 'Tipografía y color' : 'Color'}
            </Typography>
          )}
          {admiteTexto && (
            <Stack direction="row" spacing={0.75}>
              <FormControl size="small" fullWidth>
                <InputLabel>Fuente</InputLabel>
                <Select
                  label="Fuente"
                  value={estilo.fontFamily ?? ''}
                  onChange={(evento) =>
                    cambiarEstilo('fontFamily', evento.target.value || undefined)
                  }
                  sx={CONTROL}
                >
                  <MenuItem value="">Original</MenuItem>
                  {FUENTES_DEL_LIENZO.map((fuente) => (
                    <MenuItem key={fuente} value={fuente}>
                      {fuente}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <CampoNumero
                etiqueta="Tamaño"
                valor={estilo.fontSize}
                onCambiar={(valor) => cambiarEstilo('fontSize', valor)}
                min={6}
                max={200}
              />
              <FormControl size="small" fullWidth>
                <InputLabel>Peso</InputLabel>
                <Select
                  label="Peso"
                  value={estilo.fontWeight ?? ''}
                  onChange={(evento) =>
                    cambiarEstilo('fontWeight', evento.target.value || undefined)
                  }
                >
                  <MenuItem value="">Original</MenuItem>
                  {['400', '500', '600', '700', '800', '900'].map((peso) => (
                    <MenuItem key={peso} value={peso}>
                      {peso}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
          )}
          {capa?.tipo !== 'imagen' && (
            <Stack direction="row" spacing={0.75}>
              {admiteTexto && (
                <Box sx={{ flex: 1 }}>
                  <CampoColor
                    etiqueta="Texto"
                    valor={estilo.color}
                    onCambiar={(valor) => cambiarEstilo('color', valor)}
                  />
                </Box>
              )}
              <Box sx={{ flex: 1 }}>
                <CampoColor
                  etiqueta="Fondo"
                  valor={estilo.backgroundColor}
                  onCambiar={(valor) => cambiarEstilo('backgroundColor', valor)}
                />
              </Box>
            </Stack>
          )}

          <Typography variant="caption" sx={{ fontWeight: 700 }}>
            Posición y tamaño {capa ? '(%)' : '(px)'}
          </Typography>
          <Box
            sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 0.75 }}
          >
            {['x', 'y', 'width', 'height'].map((campo) => (
              <CampoNumero
                key={campo}
                etiqueta={
                  campo === 'width' ? 'Ancho' : campo === 'height' ? 'Alto' : campo.toUpperCase()
                }
                valor={capa ? capa[campo] : estilo[campo]}
                onCambiar={(valor) =>
                  capa
                    ? cambiarCapa(capa.id, { [campo]: valor ?? capa[campo] })
                    : cambiarEstilo(campo, valor)
                }
                min={
                  capa
                    ? campo === 'x' || campo === 'y'
                      ? 0
                      : 1
                    : campo === 'x' || campo === 'y'
                      ? -1000
                      : 1
                }
                max={capa ? 100 : campo === 'x' || campo === 'y' ? 1000 : 2000}
              />
            ))}
          </Box>
          <Box
            sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 0.75 }}
          >
            <CampoNumero
              etiqueta="Opacidad"
              valor={Math.round((estilo.opacity ?? 1) * 100)}
              onCambiar={(valor) => cambiarEstilo('opacity', valueOrDefault(valor, 100) / 100)}
              min={0}
              max={100}
            />
            <CampoNumero
              etiqueta="Giro"
              valor={estilo.rotate}
              onCambiar={(valor) => cambiarEstilo('rotate', valor)}
              min={-360}
              max={360}
            />
            <CampoNumero
              etiqueta="Esquinas"
              valor={estilo.borderRadius}
              onCambiar={(valor) => cambiarEstilo('borderRadius', valor)}
              min={0}
              max={500}
            />
          </Box>
          {admiteTexto && (
            <>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                  gap: 0.75,
                }}
              >
                <CampoNumero
                  etiqueta="Interletrado"
                  valor={estilo.letterSpacing}
                  onCambiar={(valor) => cambiarEstilo('letterSpacing', valor)}
                  min={-5}
                  max={40}
                  paso={0.1}
                />
                <CampoNumero
                  etiqueta="Interlineado"
                  valor={estilo.lineHeight}
                  onCambiar={(valor) => cambiarEstilo('lineHeight', valor)}
                  min={0.5}
                  max={3}
                  paso={0.1}
                />
              </Box>
              <FormControl size="small" fullWidth>
                <InputLabel>Alineación</InputLabel>
                <Select
                  label="Alineación"
                  value={estilo.textAlign ?? ''}
                  onChange={(evento) =>
                    cambiarEstilo('textAlign', evento.target.value || undefined)
                  }
                >
                  <MenuItem value="">Original</MenuItem>
                  <MenuItem value="left">Izquierda</MenuItem>
                  <MenuItem value="center">Centro</MenuItem>
                  <MenuItem value="right">Derecha</MenuItem>
                </Select>
              </FormControl>
            </>
          )}
        </>
      )}
    </Stack>
  );
}

const valueOrDefault = (valor, deSiempre) => (valor === undefined ? deSiempre : valor);
