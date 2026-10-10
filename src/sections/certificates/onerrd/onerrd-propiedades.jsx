import { useRef, useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Slider from '@mui/material/Slider';
import Switch from '@mui/material/Switch';
import Tooltip from '@mui/material/Tooltip';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import ButtonBase from '@mui/material/ButtonBase';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import ToggleButton from '@mui/material/ToggleButton';
import InputAdornment from '@mui/material/InputAdornment';
import FormControlLabel from '@mui/material/FormControlLabel';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

import {
  PESOS_ONERRD,
  FUENTES_ONERRD,
  REGIONES_ONERRD,
  pesoDeCampoOnerrd,
  acotarRotacionOnerrd,
  cssDeDegradadoOnerrd,
  ESPACIADO_MINIMO_ONERRD,
  ESPACIADO_MAXIMO_ONERRD,
  DEGRADADO_INICIAL_ONERRD,
  seEscribeEnElLienzoOnerrd,
} from 'src/utils/certificado-onerrd.mjs';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------
// PROPIEDADES DEL ELEMENTO ELEGIDO EN EL LIENZO. Lo mismo que se hace con el
// ratón, con números exactos: posición, tamaño, fuente, color…
// ----------------------------------------------------------------------

// El texto se edita en local: así se puede borrar el número entero para
// escribir otro (con el valor atado al diseño, el campo vacío volvía solo al
// número anterior). Se aplica en cuanto es un número válido, acotado.
export function NumeroCampo({ label, value, onChange, min, max, step = 0.1, sx }) {
  const [texto, setTexto] = useState(String(value));
  const [enfocado, setEnfocado] = useState(false);
  // Lo último que vale, para las flechas mantenidas (un intervalo vería el
  // valor de cuando se pulsó y no sumaría nada).
  const valorRef = useRef(value);
  valorRef.current = value;
  const parar = useRef(null);

  useEffect(() => {
    if (!enfocado) setTexto(String(value));
  }, [value, enfocado]);

  useEffect(() => () => parar.current?.(), []);

  const decimales = Math.max(2, (String(step).split('.')[1] || '').length);

  const pasar = (direccion) => {
    const n = Number(valorRef.current) || 0;
    const nuevo = Number(Math.min(max, Math.max(min, n + direccion * step)).toFixed(decimales));
    valorRef.current = nuevo;
    setTexto(String(nuevo));
    onChange(nuevo);
  };

  // Un toque suma un paso; mantenida, la flecha sigue sumando.
  const empezar = (direccion) => (evento) => {
    // Sin esto el campo perdía el foco y el número se volvía a escribir.
    evento.preventDefault();
    parar.current?.();
    pasar(direccion);
    let repetir = null;
    const espera = setTimeout(() => {
      repetir = setInterval(() => pasar(direccion), 70);
    }, 400);
    const soltar = () => {
      clearTimeout(espera);
      clearInterval(repetir);
      window.removeEventListener('pointerup', soltar);
      window.removeEventListener('pointercancel', soltar);
      parar.current = null;
    };
    parar.current = soltar;
    window.addEventListener('pointerup', soltar);
    window.addEventListener('pointercancel', soltar);
  };

  const flecha = (direccion, icono, titulo) => (
    <ButtonBase
      aria-label={titulo}
      tabIndex={-1}
      disabled={direccion > 0 ? value >= max : value <= min}
      onPointerDown={empezar(direccion)}
      sx={{
        width: 18,
        height: 14,
        borderRadius: 0.5,
        color: 'text.secondary',
        '&:hover': { color: 'text.primary', bgcolor: 'action.hover' },
        '&.Mui-disabled': { opacity: 0.3 },
      }}
    >
      <Iconify icon={icono} width={14} />
    </ButtonBase>
  );

  return (
    <TextField
      size="small"
      type="number"
      label={label}
      value={texto}
      onFocus={() => setEnfocado(true)}
      onBlur={() => {
        setEnfocado(false);
        setTexto(String(value));
      }}
      onChange={(event) => {
        setTexto(event.target.value);
        const n = Number(event.target.value);
        if (event.target.value !== '' && Number.isFinite(n)) {
          onChange(Math.min(max, Math.max(min, n)));
        }
      }}
      slotProps={{
        htmlInput: { min, max, step },
        // Las flechas, dentro del campo y sin cambiar su tamaño: le quitan
        // sitio al número, no ensanchan la caja.
        input: {
          sx: { pr: 0.5 },
          endAdornment: (
            <InputAdornment position="end" sx={{ ml: 0.25, height: 'auto' }}>
              <Stack spacing={0}>
                {flecha(1, 'eva:arrow-ios-upward-fill', 'Aumentar')}
                {flecha(-1, 'eva:arrow-ios-downward-fill', 'Disminuir')}
              </Stack>
            </InputAdornment>
          ),
        },
      }}
      sx={{
        minWidth: 0,
        // Las del navegador no: dos pares de flechas confundían.
        '& input[type=number]': { MozAppearance: 'textfield' },
        '& input::-webkit-outer-spin-button, & input::-webkit-inner-spin-button': {
          WebkitAppearance: 'none',
          m: 0,
        },
        ...sx,
      }}
    />
  );
}

const QUE_MUESTRA = {
  fijo: 'Texto fijo (igual en todos)',
  texto: 'Dato de cada certificado',
  anio: 'Año del registro',
  fecha: 'Fecha',
  numero: 'Número de registro',
  emision: 'Fecha y hora de emisión (UTC-4)',
};

const AYUDA_POR_TIPO = {
  fijo: 'Se escribe en su caja (doble clic) y se guarda con el diseño: sale igual en todos los certificados.',
  texto: 'El texto se escribe en su caja del certificado: doble clic o Intro.',
  anio: 'El año se escribe en su caja (doble clic) o en "Datos del registro": es uno solo y numera los certificados.',
  numero: 'Lo pone el sistema al emitir.',
  fecha: 'Se elige en "Datos del registro".',
  emision:
    'La pone el sistema al emitir: 07/10/2026 UTC-4 10:05 A.M. (en la vista previa, la de ahora).',
};

// Relleno en degradado (como las letras de CERTIFICADO / REGISTRO): los dos
// colores, hacia dónde va, dónde empieza y acaba la mezcla y si se refleja.
// El color de inicio es el mismo de la letra.
function Degradado({ campo, cambiar }) {
  const reparto = [campo.inicioDegradado ?? 0, campo.finDegradado ?? 100];
  return (
    <Stack spacing={1.5}>
      <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={!!campo.degradado}
              onChange={(event) =>
                cambiar(
                  event.target.checked
                    ? {
                        degradado: true,
                        // De entrada, los colores de CERTIFICADO / REGISTRO.
                        color: DEGRADADO_INICIAL_ONERRD.inicio,
                        colorFin: DEGRADADO_INICIAL_ONERRD.fin,
                        anguloDegradado: campo.anguloDegradado ?? 90,
                        inicioDegradado: campo.inicioDegradado ?? 0,
                        finDegradado: campo.finDegradado ?? 100,
                        reflejarDegradado: campo.reflejarDegradado ?? true,
                      }
                    : { degradado: false }
                )
              }
            />
          }
          label="Degradado"
          sx={{ mr: 0 }}
        />
        {campo.degradado && (
          <>
            <Tooltip title="Color de inicio (el de la letra)">
              <Box>
                <SelectorDeColor valor={campo.color} onCambiar={(color) => cambiar({ color })} />
              </Box>
            </Tooltip>
            <Tooltip title="Intercambiar los colores">
              <IconButton
                size="small"
                onClick={() => cambiar({ color: campo.colorFin, colorFin: campo.color })}
              >
                <Iconify icon="solar:restart-bold" width={18} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Color final">
              <Box>
                <SelectorDeColor
                  valor={campo.colorFin || DEGRADADO_INICIAL_ONERRD.fin}
                  onCambiar={(colorFin) => cambiar({ colorFin })}
                />
              </Box>
            </Tooltip>
            <Tooltip title="Inicio → centro → inicio, como las letras de CERTIFICADO">
              <FormControlLabel
                control={
                  <Switch
                    size="small"
                    checked={campo.reflejarDegradado !== false}
                    onChange={(event) => cambiar({ reflejarDegradado: event.target.checked })}
                  />
                }
                label="Reflejar"
                sx={{ mr: 0 }}
              />
            </Tooltip>
          </>
        )}
      </Stack>

      {campo.degradado && (
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} alignItems="center">
          {/* Muestra del degradado tal como irá en la letra. */}
          <Box
            sx={{
              width: 64,
              height: 28,
              flexShrink: 0,
              borderRadius: 0.75,
              backgroundImage: cssDeDegradadoOnerrd(campo),
              border: (theme) => `1px solid ${theme.vars.palette.divider}`,
            }}
          />
          <Box sx={{ flex: 1, width: 1, px: 1 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Dirección: {Math.round(campo.anguloDegradado ?? 90)}°
            </Typography>
            <Slider
              size="small"
              min={0}
              max={359}
              value={campo.anguloDegradado ?? 90}
              onChange={(event, anguloDegradado) => cambiar({ anguloDegradado })}
              marks={[0, 90, 180, 270].map((value) => ({ value }))}
            />
          </Box>
          <Box sx={{ flex: 1, width: 1, px: 1 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Mezcla: del {Math.round(reparto[0])} % al {Math.round(reparto[1])} %
            </Typography>
            <Slider
              size="small"
              min={0}
              max={100}
              value={reparto}
              disableSwap
              onChange={(event, [inicioDegradado, finDegradado]) =>
                cambiar({ inicioDegradado, finDegradado })
              }
            />
          </Box>
        </Stack>
      )}
    </Stack>
  );
}

// El rojo granate del número de la plantilla: el contorno que más se usa.
const CONTORNO_INICIAL = '#9A2222';

const redondear2 = (valor) => Math.round(valor * 100) / 100;

// − número +: para afinar sin teclear (espaciado, grosor del contorno).
export function Escalon({ label, value, min, max, paso, menos, mas, onChange }) {
  const mover = (delta) => onChange(redondear2(Math.min(max, Math.max(min, value + delta))));
  return (
    <Stack direction="row" alignItems="center" spacing={0.25}>
      <Tooltip title={menos}>
        <span>
          <IconButton size="small" disabled={value <= min} onClick={() => mover(-paso)}>
            <Iconify icon="mingcute:minimize-line" width={18} />
          </IconButton>
        </span>
      </Tooltip>
      <NumeroCampo
        label={label}
        value={value}
        min={min}
        max={max}
        step={paso}
        onChange={onChange}
        sx={{ width: 96 }}
      />
      <Tooltip title={mas}>
        <span>
          <IconButton size="small" disabled={value >= max} onClick={() => mover(paso)}>
            <Iconify icon="mingcute:add-line" width={18} />
          </IconButton>
        </span>
      </Tooltip>
    </Stack>
  );
}

export function SelectorDeColor({ valor, onCambiar }) {
  return (
    <Box
      component="label"
      sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer' }}
    >
      <Box
        component="input"
        type="color"
        value={valor}
        onChange={(event) => onCambiar(event.target.value.toUpperCase())}
        sx={{
          width: 36,
          height: 36,
          p: 0,
          border: 0,
          bgcolor: 'transparent',
          cursor: 'pointer',
        }}
      />
      <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
        {valor}
      </Typography>
    </Box>
  );
}

export function Posicion({ elemento, onCambiar }) {
  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <NumeroCampo
        label="X %"
        value={elemento.x}
        min={-5}
        max={105}
        onChange={(x) => onCambiar({ x })}
        sx={{ flex: 1 }}
      />
      <NumeroCampo
        label="Y %"
        value={elemento.y}
        min={-5}
        max={105}
        onChange={(y) => onCambiar({ y })}
        sx={{ flex: 1 }}
      />
      <NumeroCampo
        label="Ancho %"
        value={elemento.ancho}
        min={2}
        max={100}
        onChange={(ancho) => onCambiar({ ancho })}
        sx={{ flex: 1 }}
      />
      <Tooltip title="Centrar en la hoja">
        <IconButton onClick={() => onCambiar({ x: 50 })}>
          <Iconify icon="solar:align-right-bold-duotone" sx={{ transform: 'rotate(90deg)' }} />
        </IconButton>
      </Tooltip>
    </Stack>
  );
}

// Giro sobre el centro: grados, deslizador, ±90° y enderezar. Lo usan las
// firmas, los textos y el sello de la factura.
export function ControlDeGiro({ valor = 0, onCambiar }) {
  const girar = (grados) => onCambiar(acotarRotacionOnerrd(grados));
  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
      <Escalon
        label="Giro (°)"
        value={valor ?? 0}
        min={-180}
        max={180}
        paso={1}
        menos="Girar a la izquierda"
        mas="Girar a la derecha"
        onChange={girar}
      />
      <Slider
        size="small"
        min={-180}
        max={180}
        value={valor ?? 0}
        onChange={(event, grados) => onCambiar(grados)}
        marks={[-90, 0, 90].map((value) => ({ value }))}
        sx={{ flex: 1, minWidth: 160, mx: 1 }}
      />
      <Stack direction="row" spacing={0.5}>
        <Tooltip title="90° a la izquierda">
          <IconButton size="small" onClick={() => girar((valor ?? 0) - 90)}>
            <Iconify icon="solar:restart-bold" width={18} sx={{ transform: 'scaleX(-1)' }} />
          </IconButton>
        </Tooltip>
        <Tooltip title="90° a la derecha">
          <IconButton size="small" onClick={() => girar((valor ?? 0) + 90)}>
            <Iconify icon="solar:restart-bold" width={18} />
          </IconButton>
        </Tooltip>
        <Button size="small" color="inherit" onClick={() => onCambiar(0)}>
          Enderezar
        </Button>
      </Stack>
    </Stack>
  );
}

export function PropiedadesOnerrd({
  seleccion,
  diseno,
  firmasActivas,
  onCambiarElemento,
  onEliminarCampo,
  onSubirImagen,
  onQuitarImagen,
  tieneImagen,
  region,
  onCambiarRegion,
  iconosRegion = {},
  fotosRegion = {},
  cargandoFotosRegion,
  subiendoRegion,
  onSubirIconoRegion,
  onQuitarIconoRegion,
  // Las imágenes subidas al certificado: { id: { nombreArchivo, … } }.
  imagenesSubidas = {},
  onQuitarImagenSubida,
}) {
  if (!seleccion) {
    return (
      <Typography variant="body2" sx={{ color: 'text.secondary', py: 1 }}>
        Pulsa un texto, la imagen, el icono de la región, una firma o el código QR en el certificado
        para moverlo o cambiarlo. Arrastra para mover, las asas para cambiar el tamaño y las flechas
        del teclado para afinar (Mayús = más rápido). Con la cuadrícula a la vista se pega a sus
        líneas, y un texto, a sus vecinos: mantén Ctrl (o Alt) mientras arrastras para soltarlo.
        Doble clic en un texto (o Intro) para escribirlo dentro de su caja. Ctrl + C y Ctrl + V
        copian y pegan un texto (Ctrl + D lo duplica) y Supr lo elimina.
      </Typography>
    );
  }

  if (seleccion.tipo === 'imagen') {
    const cambiar = (cambios) => onCambiarElemento('imagen', 'imagen', cambios);
    return (
      <Stack spacing={2}>
        <Typography variant="subtitle2">Imagen</Typography>
        <Posicion elemento={diseno.imagen} onCambiar={cambiar} />
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Button
            variant="outlined"
            startIcon={<Iconify icon="solar:gallery-add-bold" />}
            onClick={onSubirImagen}
          >
            {tieneImagen ? 'Cambiar imagen' : 'Subir imagen'}
          </Button>
          {tieneImagen && (
            <Button
              color="error"
              startIcon={<Iconify icon="solar:trash-bin-trash-bold" />}
              onClick={onQuitarImagen}
            >
              Quitar
            </Button>
          )}
          <FormControlLabel
            control={
              <Switch
                checked={diseno.imagen.visible}
                onChange={(event) => cambiar({ visible: event.target.checked })}
              />
            }
            label="Mostrar"
          />
        </Stack>
      </Stack>
    );
  }

  if (seleccion.tipo === 'iconoRegion') {
    const cambiar = (cambios) => onCambiarElemento('iconoRegion', 'iconoRegion', cambios);
    return (
      <Stack spacing={2}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Typography variant="subtitle2" sx={{ flex: 1 }}>
            Icono de la región
          </Typography>
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={diseno.iconoRegion.visible}
                onChange={(event) => cambiar({ visible: event.target.checked })}
              />
            }
            label="Mostrar"
          />
        </Stack>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Sale la imagen de la región del participante (la de «Datos del registro»), la misma de
          Niveles organizacionales. Arrastra para moverlo y usa el asa para cambiar su tamaño; la
          posición y el tamaño se guardan con «Guardar diseño» y valen para las cuatro regiones.
        </Typography>
        <TextField
          select
          size="small"
          label="Región"
          value={region}
          onChange={(event) => onCambiarRegion(event.target.value)}
        >
          <MenuItem value="">Sin región</MenuItem>
          {REGIONES_ONERRD.map((item) => (
            <MenuItem key={item.id} value={item.id}>
              {item.nombre}
            </MenuItem>
          ))}
        </TextField>
        <Posicion elemento={diseno.iconoRegion} onCambiar={cambiar} />

        {/* La imagen de cada región: su foto de Niveles organizacionales, o una
            propia del certificado si se elige otra. */}
        <Box
          sx={{
            display: 'grid',
            gap: 1,
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
          }}
        >
          {REGIONES_ONERRD.map((item) => {
            const propio = iconosRegion[item.id];
            const icono = propio || fotosRegion[item.id];
            return (
              <Stack
                key={item.id}
                direction="row"
                spacing={1.5}
                alignItems="center"
                sx={{
                  p: 1,
                  borderRadius: 1,
                  border: (theme) =>
                    `1px solid ${
                      item.id === region
                        ? theme.vars.palette.primary.main
                        : theme.vars.palette.divider
                    }`,
                }}
              >
                <ButtonBase
                  onClick={() => onCambiarRegion(item.id)}
                  sx={{
                    width: 44,
                    height: 44,
                    flexShrink: 0,
                    borderRadius: 1,
                    bgcolor: 'background.neutral',
                  }}
                >
                  {icono?.dataUrl ? (
                    <Box
                      component="img"
                      src={icono.dataUrl}
                      alt={item.nombre}
                      sx={{ width: 40, height: 40, objectFit: 'contain' }}
                    />
                  ) : (
                    <Iconify icon="solar:gallery-add-bold" sx={{ color: 'text.disabled' }} />
                  )}
                </ButtonBase>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" noWrap>
                    {item.nombre}
                  </Typography>
                  <Typography variant="caption" noWrap sx={{ color: 'text.secondary' }}>
                    {propio
                      ? 'Imagen propia del certificado'
                      : fotosRegion[item.id]
                        ? 'De Niveles organizacionales'
                        : cargandoFotosRegion
                          ? 'Cargando de Niveles…'
                          : 'Sin foto en Niveles'}
                  </Typography>
                  <Stack direction="row" spacing={0.5}>
                    <Button
                      size="small"
                      disabled={!!subiendoRegion}
                      onClick={() => onSubirIconoRegion(item.id)}
                      sx={{ px: 0.5, minWidth: 0 }}
                    >
                      {subiendoRegion === item.id
                        ? 'Subiendo…'
                        : icono
                          ? 'Usar otra'
                          : 'Subir imagen'}
                    </Button>
                    {propio && (
                      <Button
                        size="small"
                        color="inherit"
                        disabled={!!subiendoRegion}
                        onClick={() => onQuitarIconoRegion(item.id)}
                        sx={{ px: 0.5, minWidth: 0 }}
                      >
                        Volver a la de Niveles
                      </Button>
                    )}
                  </Stack>
                </Box>
              </Stack>
            );
          })}
        </Box>
      </Stack>
    );
  }

  if (seleccion.tipo === 'imagenes') {
    const item = (diseno.imagenes || []).find((imagen) => imagen.id === seleccion.id);
    if (!item) return null;
    const cambiar = (cambios) => onCambiarElemento('imagenes', item.id, cambios);
    return (
      <Stack spacing={2}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Typography variant="subtitle2" sx={{ flex: 1 }} noWrap>
            {imagenesSubidas[item.id]?.nombreArchivo || 'Imagen'}
          </Typography>
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={item.visible}
                onChange={(event) => cambiar({ visible: event.target.checked })}
              />
            }
            label="Mostrar"
          />
        </Stack>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Arrastra para moverla; el asa cuadrada cambia su tamaño y la redonda la gira. Para añadir
          más, «Subir imagen» o arrastra archivos encima del certificado.
        </Typography>
        <Posicion elemento={item} onCambiar={cambiar} />
        <ControlDeGiro valor={item.rotacion} onCambiar={(rotacion) => cambiar({ rotacion })} />
        <Button
          color="error"
          startIcon={<Iconify icon="solar:trash-bin-trash-bold" />}
          onClick={() => onQuitarImagenSubida?.(item.id)}
          sx={{ alignSelf: 'flex-start' }}
        >
          Quitar del certificado
        </Button>
      </Stack>
    );
  }

  if (seleccion.tipo === 'firma') {
    const ranura = diseno.firmas.find((item) => item.id === seleccion.id);
    if (!ranura) return null;
    const cambiar = (cambios) => onCambiarElemento('firma', ranura.id, cambios);
    return (
      <Stack spacing={2}>
        <Typography variant="subtitle2">{ranura.etiqueta}</Typography>
        <TextField
          select
          size="small"
          label="Firma"
          value={firmasActivas.some((firma) => firma.id === ranura.idFirma) ? ranura.idFirma : ''}
          onChange={(event) => cambiar({ idFirma: event.target.value })}
        >
          <MenuItem value="">Sin firma</MenuItem>
          {firmasActivas.map((firma) => (
            <MenuItem key={firma.id} value={firma.id}>
              {firma.nombre}
            </MenuItem>
          ))}
        </TextField>
        <Posicion elemento={ranura} onCambiar={cambiar} />

        {/* Giro sobre el centro (también con el asa redonda de encima de la firma). */}
        <ControlDeGiro valor={ranura.rotacion} onCambiar={(rotacion) => cambiar({ rotacion })} />
      </Stack>
    );
  }

  if (seleccion.tipo === 'qr') {
    const cambiar = (cambios) => onCambiarElemento('qr', 'qr', cambios);
    return (
      <Stack spacing={2}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Typography variant="subtitle2" sx={{ flex: 1 }}>
            Código QR
          </Typography>
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={diseno.qr.visible}
                onChange={(event) => cambiar({ visible: event.target.checked })}
              />
            }
            label="Mostrar"
          />
        </Stack>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Al escanearlo abre el certificado guardado, con la fecha y hora de generación, en la
          dirección publicada del ambiente donde se emitió (dev, qa o producción; también si se
          emite desde localhost). Cada certificado lleva su propia clave en el enlace, así que no se
          pueden consultar otros probando números. En el PDF de prueba lleva a un aviso de que no
          tiene validez. Arrastra para moverlo y usa el asa para cambiar su tamaño.
        </Typography>
        <Posicion elemento={diseno.qr} onCambiar={cambiar} />
        <Stack direction="row" spacing={1} alignItems="center">
          <Tooltip title="Color del código (oscuro sobre blanco para que se lea bien)">
            <Box>
              <SelectorDeColor valor={diseno.qr.color} onCambiar={(color) => cambiar({ color })} />
            </Box>
          </Tooltip>
          {diseno.qr.color !== '#000000' && (
            <Button size="small" color="inherit" onClick={() => cambiar({ color: '#000000' })}>
              Volver a negro
            </Button>
          )}
        </Stack>
      </Stack>
    );
  }

  const campo = diseno.campos.find((item) => item.id === seleccion.id);
  if (!campo) return null;
  const cambiar = (cambios) => onCambiarElemento('campo', campo.id, cambios);
  const fuente = FUENTES_ONERRD.find((item) => item.value === campo.fuente);

  return (
    <Stack spacing={2}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <Typography variant="subtitle2" sx={{ flex: 1 }}>
          {campo.etiqueta}
        </Typography>
        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={campo.visible}
              onChange={(event) => cambiar({ visible: event.target.checked })}
            />
          }
          label="Mostrar"
        />
        {!campo.deFabrica && (
          <Tooltip title="Eliminar este texto del diseño">
            <IconButton color="error" onClick={() => onEliminarCampo(campo.id)}>
              <Iconify icon="solar:trash-bin-trash-bold" />
            </IconButton>
          </Tooltip>
        )}
      </Stack>

      {/* El texto en sí se escribe en su caja del lienzo: aquí había un "Texto
          de ejemplo" que se veía en el certificado pero no salía en el PDF. */}
      <TextField
        size="small"
        label="Nombre del dato"
        value={campo.etiqueta}
        onChange={(event) => cambiar({ etiqueta: event.target.value })}
        helperText={AYUDA_POR_TIPO[campo.tipo]}
      />

      {!campo.deFabrica && (
        // Un texto añadido puede enseñar uno de los datos del registro: así un
        // "2027" puesto a mano pasa a ser el año del registro y cambia con él.
        <TextField
          select
          size="small"
          label="Qué muestra"
          value={campo.tipo}
          onChange={(event) => cambiar({ tipo: event.target.value })}
        >
          {Object.entries(QUE_MUESTRA).map(([tipo, nombre]) => (
            <MenuItem key={tipo} value={tipo}>
              {nombre}
            </MenuItem>
          ))}
        </TextField>
      )}

      {seEscribeEnElLienzoOnerrd(campo) && (
        // Lo que va siempre alrededor del dato: en la iglesia,
        // ASAMBLEA DE DIOS “ … ”, y se escribe solo el nombre.
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <TextField
            size="small"
            label="Texto fijo antes"
            value={campo.prefijo ?? ''}
            onChange={(event) => cambiar({ prefijo: event.target.value })}
            slotProps={{ htmlInput: { maxLength: 80 } }}
            sx={{ flex: 2 }}
          />
          <TextField
            size="small"
            label="Texto fijo después"
            value={campo.sufijo ?? ''}
            onChange={(event) => cambiar({ sufijo: event.target.value })}
            slotProps={{ htmlInput: { maxLength: 80 } }}
            sx={{ flex: 1 }}
          />
        </Stack>
      )}

      <Posicion elemento={campo} onCambiar={cambiar} />

      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
        <TextField
          select
          size="small"
          label="Fuente"
          value={campo.fuente}
          onChange={(event) => {
            const nueva = FUENTES_ONERRD.find((item) => item.value === event.target.value);
            // El grueso se conserva si la letra nueva lo tiene; si no, el
            // más cercano entre normal y negrita.
            const actual = pesoDeCampoOnerrd(campo);
            const peso = nueva?.pesos?.includes(actual)
              ? actual
              : nueva?.negrita && actual >= 600
                ? 700
                : 400;
            cambiar({
              fuente: event.target.value,
              peso,
              negrita: peso >= 600,
              ...(!nueva?.cursiva && { cursiva: false }),
            });
          }}
          sx={{ minWidth: 130 }}
        >
          {FUENTES_ONERRD.map((item) => (
            <MenuItem key={item.value} value={item.value} sx={{ fontFamily: item.css }}>
              {item.label}
            </MenuItem>
          ))}
        </TextField>
        <NumeroCampo
          label="Tamaño (pt)"
          value={campo.tamano}
          min={4}
          max={160}
          step={0.5}
          onChange={(tamano) => cambiar({ tamano })}
          sx={{ width: 110 }}
        />
        <Tooltip title="Color de la letra">
          <Box>
            <SelectorDeColor valor={campo.color} onCambiar={(color) => cambiar({ color })} />
          </Box>
        </Tooltip>
      </Stack>

      {/* Separación entre letras (o números): menos de 0 las junta. */}
      <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
        <Escalon
          label="Espaciado"
          value={campo.espaciado}
          min={ESPACIADO_MINIMO_ONERRD}
          max={ESPACIADO_MAXIMO_ONERRD}
          paso={0.5}
          menos="Juntar las letras"
          mas="Separar las letras"
          onChange={(espaciado) => cambiar({ espaciado })}
        />

        {/* Contorno por fuera de la letra, como el número del laurel. */}
        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={!!campo.contorno}
              onChange={(event) =>
                cambiar(
                  event.target.checked
                    ? { contorno: CONTORNO_INICIAL, grosorContorno: 1 }
                    : { contorno: '', grosorContorno: 0 }
                )
              }
            />
          }
          label="Contorno"
          sx={{ mr: 0 }}
        />
        {campo.contorno && (
          <>
            <Tooltip title="Color del contorno">
              <Box>
                <SelectorDeColor
                  valor={campo.contorno}
                  onCambiar={(contorno) => cambiar({ contorno })}
                />
              </Box>
            </Tooltip>
            <Escalon
              label="Grosor (pt)"
              value={campo.grosorContorno}
              min={0.2}
              max={20}
              paso={0.2}
              menos="Contorno más fino"
              mas="Contorno más grueso"
              onChange={(grosorContorno) => cambiar({ grosorContorno })}
            />
          </>
        )}
      </Stack>

      <Degradado campo={campo} cambiar={cambiar} />

      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
        <ToggleButtonGroup
          size="small"
          value={[pesoDeCampoOnerrd(campo) >= 600 && 'negrita', campo.cursiva && 'cursiva'].filter(
            Boolean
          )}
          onChange={(event, valores) => {
            const negrita = Boolean(fuente?.negrita && valores.includes('negrita'));
            cambiar({
              negrita,
              peso: negrita ? 700 : 400,
              cursiva: fuente?.cursiva ? valores.includes('cursiva') : false,
            });
          }}
        >
          <ToggleButton
            value="negrita"
            disabled={!fuente?.negrita}
            sx={{ fontWeight: 800, px: 1.5 }}
          >
            N
          </ToggleButton>
          <ToggleButton
            value="cursiva"
            disabled={!fuente?.cursiva}
            sx={{ fontStyle: 'italic', px: 1.5 }}
          >
            K
          </ToggleButton>
        </ToggleButtonGroup>
        {fuente?.pesos && (
          <TextField
            select
            size="small"
            label="Grosor"
            value={pesoDeCampoOnerrd(campo)}
            onChange={(event) => {
              const peso = Number(event.target.value);
              cambiar({ peso, negrita: peso >= 600 });
            }}
            sx={{ minWidth: 150 }}
          >
            {fuente.pesos.map((peso) => (
              <MenuItem key={peso} value={peso} sx={{ fontFamily: fuente.css, fontWeight: peso }}>
                {peso} · {PESOS_ONERRD[peso]?.nombre}
              </MenuItem>
            ))}
          </TextField>
        )}
        <ToggleButtonGroup
          exclusive
          size="small"
          value={campo.alineacion}
          onChange={(event, alineacion) => alineacion && cambiar({ alineacion })}
        >
          <ToggleButton value="left">Izq.</ToggleButton>
          <ToggleButton value="center">Centro</ToggleButton>
          <ToggleButton value="right">Der.</ToggleButton>
        </ToggleButtonGroup>
        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={campo.mayusculas}
              onChange={(event) => cambiar({ mayusculas: event.target.checked })}
            />
          }
          label="MAYÚSCULAS"
        />
        <Tooltip title="Si el texto no cabe en su caja, la letra se reduce en vez de pasar a otra línea">
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={campo.ajustarAlAncho}
                onChange={(event) => cambiar({ ajustarAlAncho: event.target.checked })}
              />
            }
            label="Encoger para caber"
          />
        </Tooltip>
      </Stack>

      {/* Giro sobre el centro de la caja (también con el asa redonda de encima). */}
      <ControlDeGiro valor={campo.rotacion} onCambiar={(rotacion) => cambiar({ rotacion })} />
    </Stack>
  );
}
