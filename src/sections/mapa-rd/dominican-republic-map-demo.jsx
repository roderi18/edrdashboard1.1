'use client';

import { useRef, useMemo, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Tooltip from '@mui/material/Tooltip';
import SvgIcon from '@mui/material/SvgIcon';
import Snackbar from '@mui/material/Snackbar';
import { useTheme } from '@mui/material/styles';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import FormControlLabel from '@mui/material/FormControlLabel';

import { REGIONES_RD, regionDeProvincia } from 'src/utils/regiones-de-provincias.mjs';

import { Iconify } from 'src/components/iconify';

import provincias from './provincias.geo.json';
import { useGestosMapa } from './use-gestos-mapa';
import { MIN_ZOOM, MAX_ZOOM } from './gestos-mapa.mjs';
import geografia from './republica-dominicana.geo.json';
import { agruparPor } from './destacamentos-del-mapa.mjs';
import { MAP_WIDTH, MAP_HEIGHT, crearContorno, crearProyeccion } from './geometria-mapa.mjs';
import {
  MarcoEditable,
  PanelEditorMapa,
  ElementosEditables,
  useComposicionMapa,
} from './editor-mapa';
import {
  LeyendaDeRegiones,
  NumerosDeProvincias,
  useDestacamentosDelMapa,
} from './destacamentos-en-mapa';

const COUNTRY_PATH = crearContorno(geografia.geometry);
const proyectarNombre = crearProyeccion(geografia.geometry);
const PROVINCE_PATHS = provincias.features.map((provincia) => ({
  id: provincia.properties.iso,
  path: crearContorno(provincia.geometry, geografia.geometry),
  nombre: provincia.properties.name,
  region: regionDeProvincia(provincia.properties.name),
  posicion: proyectarNombre(provincia.properties.label),
  lineas: provincia.properties.name.split(' ').reduce((lineas, palabra) => {
    const ultima = lineas.length - 1;
    if (ultima < 0 || `${lineas[ultima]} ${palabra}`.length > 14) lineas.push(palabra);
    else lineas[ultima] += ` ${palabra}`;
    return lineas;
  }, []),
}));
const NOMBRES_DEL_MAPA = PROVINCE_PATHS.map((provincia) => provincia.nombre);
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

/** `alto`: pantalla entera por defecto; dentro del panel, lo que deja la cabecera. */
export function DominicanRepublicMapDemo({
  alto = '100dvh',
  datosDestacamentos,
  provinciaSeleccionada = '',
  onSeleccionarProvincia,
} = {}) {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const theme = useTheme();
  // "Ver regiones": cada provincia con el color de su región, como en el mapa de
  // la landing de registro (Norte amarillo, Central azul, Sur rojo, Este verde).
  const [mostrarRegiones, setMostrarRegiones] = useState(true);
  const [mostrarProvincias, setMostrarProvincias] = useState(true);
  // Con las regiones se ven también las divisiones: son las mismas provincias.
  const conDivisiones = mostrarProvincias || mostrarRegiones;
  const [mostrarNombres, setMostrarNombres] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [pantallaAmpliada, setPantallaAmpliada] = useState(false);
  const editor = useComposicionMapa();
  const { vista, arrastrando, restablecer, ampliar, eventos } = useGestosMapa(svgRef);
  const { zoom, x, y } = vista;
  const pantallaCompleta = isFullscreen || pantallaAmpliada;
  // Los destacamentos del padrón: un número por provincia y el total por región.
  const destacamentosDelHook = useDestacamentosDelMapa(
    NOMBRES_DEL_MAPA,
    datosDestacamentos === undefined
  );
  const destacamentos =
    datosDestacamentos === undefined ? destacamentosDelHook : datosDestacamentos;
  const porProvincia = useMemo(() => agruparPor(destacamentos || [], 'provincia'), [destacamentos]);
  const porRegion = useMemo(() => agruparPor(destacamentos || [], 'region'), [destacamentos]);
  // La región señalada en la leyenda se pinta sobre el mapa.
  const [regionSenalada, setRegionSenalada] = useState(null);
  const contenedor = () => containerRef.current;

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
        height: pantallaAmpliada ? '100dvh' : alto,
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
            {conDivisiones && (
              <g
                clipPath="url(#country-clip)"
                pointerEvents="none"
                data-testid="divisiones-provinciales"
              >
                {PROVINCE_PATHS.map((provincia) => (
                  <path
                    key={provincia.id}
                    d={provincia.path}
                    fill={
                      mostrarRegiones && provincia.region
                        ? theme.palette[provincia.region.color].main
                        : 'none'
                    }
                    fillOpacity={
                      provinciaSeleccionada && provinciaSeleccionada !== provincia.nombre
                        ? 0.55
                        : 0.9
                    }
                    stroke={mostrarRegiones ? '#ffffff' : '#a2c9d7'}
                    strokeOpacity={mostrarRegiones ? 0.6 : 0.65}
                    strokeWidth={1}
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
              </g>
            )}
            {onSeleccionarProvincia &&
              PROVINCE_PATHS.map((provincia) => (
                <path
                  key={`seleccionar-${provincia.id}`}
                  d={provincia.path}
                  fill="transparent"
                  stroke={provinciaSeleccionada === provincia.nombre ? '#fff' : 'none'}
                  strokeWidth={provinciaSeleccionada === provincia.nombre ? 3 : 0}
                  vectorEffect="non-scaling-stroke"
                  role="button"
                  tabIndex={0}
                  aria-label={`Ver datos de ${provincia.nombre}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onSeleccionarProvincia(provincia.nombre);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onSeleccionarProvincia(provincia.nombre);
                    }
                  }}
                  style={{ cursor: 'pointer' }}
                />
              ))}
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
            {regionSenalada && (
              <g clipPath="url(#country-clip)" pointerEvents="none" data-testid="region-senalada">
                {PROVINCE_PATHS.filter((p) => p.region?.nombre === regionSenalada).map((p) => (
                  <path
                    key={p.id}
                    d={p.path}
                    fill={theme.palette[p.region.color].main}
                    fillOpacity={0.9}
                    stroke="#ffffff"
                    strokeOpacity={0.6}
                    strokeWidth={1}
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
              </g>
            )}
            {conDivisiones && mostrarNombres && (
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
            {destacamentos && (
              <NumerosDeProvincias
                provincias={PROVINCE_PATHS}
                porProvincia={porProvincia}
                zoom={zoom}
                subir={conDivisiones && mostrarNombres ? 22 / Math.sqrt(zoom) : 0}
                contenedor={contenedor}
                onSeleccionarProvincia={onSeleccionarProvincia}
              />
            )}
          </g>
        </Box>
      </MarcoEditable>

      {destacamentos && (
        <LeyendaDeRegiones
          porRegion={porRegion}
          total={destacamentos.length}
          sinProvincia={destacamentos.filter((d) => !d.provincia).length}
          onSenalar={setRegionSenalada}
          contenedor={contenedor}
          sx={{
            position: 'absolute',
            zIndex: 1000,
            // Centrada abajo; en pantallas estrechas, a lo ancho y por encima del
            // panel de interruptores de la esquina, que si no la tapaba.
            left: { xs: 16, md: '50%' },
            right: { xs: 16, md: 'auto' },
            transform: { md: 'translateX(-50%)' },
            bottom: {
              xs: 'calc(max(16px, env(safe-area-inset-bottom)) + 150px)',
              md: 'max(16px, env(safe-area-inset-bottom))',
            },
          }}
        />
      )}

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
            label="Ver regiones"
            labelPlacement="start"
            sx={{
              m: 0,
              gap: 1,
              justifyContent: 'space-between',
              '& .MuiFormControlLabel-label': { fontSize: 14, fontWeight: 600 },
            }}
            control={
              <Switch
                checked={mostrarRegiones}
                onChange={(_, checked) => setMostrarRegiones(checked)}
                slotProps={{ input: { 'aria-label': 'Ver regiones por colores' } }}
              />
            }
          />
          {mostrarRegiones && (
            <Box
              data-testid="leyenda-regiones"
              sx={{ py: 0.5, gap: 0.75, display: 'grid', gridTemplateColumns: '1fr 1fr' }}
            >
              {REGIONES_RD.map((region) => (
                <Stack
                  key={region.nombre}
                  direction="row"
                  spacing={0.75}
                  sx={{ alignItems: 'center' }}
                >
                  <Box
                    sx={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      bgcolor: `${region.color}.main`,
                    }}
                  />
                  <Typography variant="caption">{region.nombre.replace('Región ', '')}</Typography>
                </Stack>
              ))}
            </Box>
          )}
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
            disabled={!conDivisiones}
            sx={{
              m: 0,
              gap: 1,
              justifyContent: 'space-between',
              '& .MuiFormControlLabel-label': { fontSize: 13 },
              '& .MuiFormControlLabel-label.Mui-disabled': { color: 'rgba(255,255,255,.4)' },
            }}
            control={
              <Switch
                checked={conDivisiones && mostrarNombres}
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
