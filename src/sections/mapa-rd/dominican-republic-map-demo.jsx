'use client';

import { useRef, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Tooltip from '@mui/material/Tooltip';
import SvgIcon from '@mui/material/SvgIcon';
import Snackbar from '@mui/material/Snackbar';
import IconButton from '@mui/material/IconButton';
import FormControlLabel from '@mui/material/FormControlLabel';

import { Iconify } from 'src/components/iconify';

import provincias from './provincias.geo.json';
import { useGestosMapa } from './use-gestos-mapa';
import { MIN_ZOOM, MAX_ZOOM } from './gestos-mapa.mjs';
import geografia from './republica-dominicana.geo.json';
import { MAP_WIDTH, MAP_HEIGHT, crearContorno, crearProyeccion } from './geometria-mapa.mjs';
import {
  MarcoEditable,
  PanelEditorMapa,
  ElementosEditables,
  useComposicionMapa,
} from './editor-mapa';

const COUNTRY_PATH = crearContorno(geografia.geometry);
const proyectarNombre = crearProyeccion(geografia.geometry);
const PROVINCE_PATHS = provincias.features.map((provincia) => ({
  id: provincia.properties.iso,
  path: crearContorno(provincia.geometry, geografia.geometry),
  nombre: provincia.properties.name,
  posicion: proyectarNombre(provincia.properties.label),
  lineas: provincia.properties.name.split(' ').reduce((lineas, palabra) => {
    const ultima = lineas.length - 1;
    if (ultima < 0 || `${lineas[ultima]} ${palabra}`.length > 14) lineas.push(palabra);
    else lineas[ultima] += ` ${palabra}`;
    return lineas;
  }, []),
}));
const PANEL_SX = {
  bgcolor: 'rgba(7, 31, 58, .92)',
  color: 'common.white',
  backdropFilter: 'blur(10px)',
  borderRadius: 2,
};
const CONTROL_SX = {
  width: 44,
  height: 44,
  color: 'common.white',
  '&:hover': { bgcolor: 'rgba(255,255,255,.12)' },
  '&.Mui-disabled': { color: 'rgba(255,255,255,.3)' },
};

export function DominicanRepublicMapDemo() {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const [mostrarProvincias, setMostrarProvincias] = useState(false);
  const [mostrarNombres, setMostrarNombres] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [pantallaAmpliada, setPantallaAmpliada] = useState(false);
  const editor = useComposicionMapa();
  const { vista, arrastrando, restablecer, ampliar, eventos } = useGestosMapa(svgRef);
  const { zoom, x, y } = vista;
  const pantallaCompleta = isFullscreen || pantallaAmpliada;

  useEffect(() => {
    const handleFullscreen = () => {
      setIsFullscreen(document.fullscreenElement === containerRef.current);
    };
    document.addEventListener('fullscreenchange', handleFullscreen);
    return () => document.removeEventListener('fullscreenchange', handleFullscreen);
  }, []);

  useEffect(() => {
    if (!pantallaAmpliada) return undefined;
    const anterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const salir = (evento) => {
      if (evento.key === 'Escape') setPantallaAmpliada(false);
    };
    window.addEventListener('keydown', salir);
    return () => {
      document.body.style.overflow = anterior;
      window.removeEventListener('keydown', salir);
    };
  }, [pantallaAmpliada]);

  const toggleFullscreen = useCallback(async () => {
    if (pantallaAmpliada) {
      setPantallaAmpliada(false);
      return;
    }
    if (document.fullscreenElement === containerRef.current) {
      await document.exitFullscreen();
      return;
    }
    try {
      if (containerRef.current?.requestFullscreen) {
        await containerRef.current.requestFullscreen();
        return;
      }
    } catch {
      // Algunos navegadores móviles no admiten fullscreen para elementos.
    }
    setPantallaAmpliada(true);
  }, [pantallaAmpliada]);

  return (
    <Box
      ref={containerRef}
      sx={{
        width: 1,
        height: '100dvh',
        position: pantallaAmpliada ? 'fixed' : 'relative',
        ...(pantallaAmpliada && { inset: 0, zIndex: 1500 }),
        overflow: 'hidden',
        overscrollBehavior: 'none',
        bgcolor: '#087f91',
        backgroundImage: 'linear-gradient(155deg, #12568a 0%, #087f91 78%)',
        '&:fullscreen': { width: '100vw', height: '100dvh' },
      }}
    >
      <MarcoEditable
        marco={editor.escena.mapa}
        activo={editor.activo}
        seleccionado={editor.seleccionado}
        contenedorRef={containerRef}
        onSeleccionar={editor.setSeleccionado}
        onCambiar={editor.actualizar}
      >
        <Box
          component="svg"
          ref={svgRef}
          role="img"
          aria-label="Mapa interactivo de República Dominicana"
          viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
          preserveAspectRatio="xMidYMid meet"
          {...(!editor.activo && eventos)}
          sx={{
            width: 1,
            height: 1,
            display: 'block',
            cursor: editor.activo ? 'move' : arrastrando ? 'grabbing' : 'grab',
            touchAction: 'none',
            userSelect: 'none',
          }}
        >
          <defs>
            <filter id="country-shadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow
                dx="0"
                dy="12"
                stdDeviation="14"
                floodColor="#052b48"
                floodOpacity="0.42"
              />
            </filter>
            <linearGradient id="country-fill" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0%" stopColor="#164b7e" />
              <stop offset="100%" stopColor="#0a315c" />
            </linearGradient>
            <clipPath id="country-clip">
              <path d={COUNTRY_PATH} />
            </clipPath>
          </defs>

          <g transform={`translate(${x} ${y}) scale(${zoom})`}>
            <path
              d={COUNTRY_PATH}
              fill="url(#country-fill)"
              fillRule="evenodd"
              filter="url(#country-shadow)"
            />
            {mostrarProvincias && (
              <g
                clipPath="url(#country-clip)"
                pointerEvents="none"
                data-testid="divisiones-provinciales"
              >
                {PROVINCE_PATHS.map((provincia) => (
                  <path
                    key={provincia.id}
                    d={provincia.path}
                    fill="none"
                    stroke="#a2c9d7"
                    strokeOpacity={0.65}
                    strokeWidth={1}
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
              </g>
            )}
            <path
              d={COUNTRY_PATH}
              fill="none"
              stroke="#52aa9b"
              strokeWidth={1.6}
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
              pointerEvents="none"
            />
            {mostrarProvincias && mostrarNombres && (
              <g pointerEvents="none" data-testid="nombres-provinciales">
                {PROVINCE_PATHS.map((provincia) => {
                  // El Distrito Nacional es pequeño: su rótulo se separa hacia el mar.
                  const esDistrito = provincia.id === 'DO-01';
                  const labelY = provincia.posicion.y + (esDistrito ? 48 : 0);
                  const tamano = 9.5 / Math.sqrt(zoom);
                  return (
                    <g key={provincia.id}>
                      {esDistrito && (
                        <line
                          x1={provincia.posicion.x}
                          y1={provincia.posicion.y}
                          x2={provincia.posicion.x}
                          y2={labelY - tamano * 1.5}
                          stroke="#c4dce6"
                          strokeWidth={0.8}
                          vectorEffect="non-scaling-stroke"
                        />
                      )}
                      <text
                        x={provincia.posicion.x}
                        y={labelY}
                        textAnchor="middle"
                        fill="#f3f8fc"
                        stroke="#0a315c"
                        strokeWidth={2.8 / Math.sqrt(zoom)}
                        strokeLinejoin="round"
                        paintOrder="stroke"
                        fontSize={tamano}
                        fontWeight="600"
                        aria-label={provincia.nombre}
                      >
                        {provincia.lineas.map((linea, indice) => (
                          <tspan
                            key={linea}
                            x={provincia.posicion.x}
                            dy={
                              indice === 0
                                ? -(provincia.lineas.length - 1) * tamano * 0.6
                                : tamano * 1.2
                            }
                          >
                            {linea}
                          </tspan>
                        ))}
                      </text>
                    </g>
                  );
                })}
              </g>
            )}
          </g>
        </Box>
      </MarcoEditable>

      <ElementosEditables editor={editor} contenedorRef={containerRef} />
      <PanelEditorMapa editor={editor} />

      <Stack
        spacing={1}
        sx={{
          position: 'absolute',
          top: 'max(16px, env(safe-area-inset-top))',
          right: 'max(16px, env(safe-area-inset-right))',
          zIndex: 1000,
        }}
      >
        <Paper elevation={6} sx={PANEL_SX}>
          <Stack direction="row">
            <Tooltip title="Restablecer vista" slotProps={{ popper: { disablePortal: true } }}>
              <IconButton aria-label="Restablecer vista" onClick={restablecer} sx={CONTROL_SX}>
                <Iconify icon="solar:restart-bold" width={22} />
              </IconButton>
            </Tooltip>
            <Tooltip
              title={pantallaCompleta ? 'Salir de pantalla completa' : 'Pantalla completa'}
              slotProps={{ popper: { disablePortal: true } }}
            >
              <IconButton
                aria-label={pantallaCompleta ? 'Salir de pantalla completa' : 'Pantalla completa'}
                onClick={toggleFullscreen}
                sx={CONTROL_SX}
              >
                <Iconify
                  icon={
                    pantallaCompleta
                      ? 'solar:quit-full-screen-square-outline'
                      : 'solar:full-screen-square-outline'
                  }
                  width={24}
                />
              </IconButton>
            </Tooltip>
          </Stack>
        </Paper>
        <Paper elevation={6} sx={PANEL_SX}>
          <Stack direction="row">
            <Tooltip title="Acercar" slotProps={{ popper: { disablePortal: true } }}>
              <span>
                <IconButton
                  aria-label="Acercar"
                  disabled={zoom >= MAX_ZOOM}
                  onClick={() => ampliar(1.3)}
                  sx={CONTROL_SX}
                >
                  <SvgIcon>
                    <path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z" />
                  </SvgIcon>
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Alejar" slotProps={{ popper: { disablePortal: true } }}>
              <span>
                <IconButton
                  aria-label="Alejar"
                  disabled={zoom <= MIN_ZOOM}
                  onClick={() => ampliar(1 / 1.3)}
                  sx={CONTROL_SX}
                >
                  <SvgIcon>
                    <path d="M5 11h14v2H5z" />
                  </SvgIcon>
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        </Paper>
        <Paper elevation={6} sx={{ ...PANEL_SX, alignSelf: 'flex-end' }}>
          <Tooltip
            title={editor.activo ? 'Cerrar editor' : 'Editar composición'}
            slotProps={{ popper: { disablePortal: true } }}
          >
            <IconButton
              aria-label={editor.activo ? 'Cerrar editor de composición' : 'Editar composición'}
              aria-pressed={editor.activo}
              onClick={() => {
                editor.setActivo((actual) => !actual);
                editor.setSeleccionado(null);
              }}
              sx={{
                ...CONTROL_SX,
                ...(editor.activo && { bgcolor: '#f4b942', color: '#071f3a' }),
              }}
            >
              <Iconify icon="solar:pen-bold" width={22} />
            </IconButton>
          </Tooltip>
        </Paper>
      </Stack>

      <Paper
        elevation={6}
        sx={{
          ...PANEL_SX,
          position: 'absolute',
          right: 'max(16px, env(safe-area-inset-right))',
          bottom: 'max(16px, env(safe-area-inset-bottom))',
          zIndex: 1000,
          px: 1.5,
          py: 0.5,
        }}
      >
        <Stack>
          <FormControlLabel
            label="Provincias"
            labelPlacement="start"
            sx={{
              m: 0,
              gap: 1,
              justifyContent: 'space-between',
              '& .MuiFormControlLabel-label': { fontSize: 14, fontWeight: 600 },
            }}
            control={
              <Switch
                checked={mostrarProvincias}
                onChange={(_, checked) => {
                  setMostrarProvincias(checked);
                  if (!checked) setMostrarNombres(false);
                }}
                slotProps={{ input: { 'aria-label': 'Mostrar divisiones provinciales' } }}
              />
            }
          />
          <FormControlLabel
            label="Nombres de provincias"
            labelPlacement="start"
            disabled={!mostrarProvincias}
            sx={{
              m: 0,
              gap: 1,
              justifyContent: 'space-between',
              '& .MuiFormControlLabel-label': { fontSize: 13 },
              '& .MuiFormControlLabel-label.Mui-disabled': { color: 'rgba(255,255,255,.4)' },
            }}
            control={
              <Switch
                checked={mostrarProvincias && mostrarNombres}
                onChange={(_, checked) => setMostrarNombres(checked)}
                slotProps={{ input: { 'aria-label': 'Mostrar nombres de provincias' } }}
              />
            }
          />
        </Stack>
      </Paper>
      <Snackbar
        open={Boolean(editor.mensaje)}
        autoHideDuration={2600}
        onClose={() => editor.setMensaje('')}
        message={editor.mensaje}
      />
    </Box>
  );
}
