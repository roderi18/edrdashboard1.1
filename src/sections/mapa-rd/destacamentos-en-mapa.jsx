'use client';

import { useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import { REGIONES_RD } from 'src/utils/regiones-de-provincias.mjs';

import { getRegionals } from 'src/services/regional-service';

import { destacamentosDelMapa, nombreDeDestacamento } from './destacamentos-del-mapa.mjs';

// ----------------------------------------------------------------------
// LOS DESTACAMENTOS SOBRE EL MAPA, como en la landing de registro: un número
// por provincia y, debajo del mapa, las cuatro regiones con su total. Al señalar
// un número o una región sale la lista de sus destacamentos (en el móvil, al
// tocar). Aquí cuenta el padrón entero, no solo los que actualizaron.
// ----------------------------------------------------------------------

// TAMAÑO DE LOS LOGOS DE LAS REGIONES en la leyenda de debajo del mapa, en
// píxeles: el primero en el celular, el segundo en pantallas grandes. El aro de
// color es ANCHO_ARO_LOGO. Cambia aquí y se ajustan los cuatro.
export const TAMANO_LOGO_REGION = { xs: 50, md: 54 };
const ANCHO_ARO_LOGO = 2;

const lista = (json) => (Array.isArray(json) ? json : json?.data || json?.Data || []);

/** Lee el padrón y lo deja con provincia y región. `null` mientras carga. */
export function useDestacamentosDelMapa(provinciasDelMapa) {
  const [destacamentos, setDestacamentos] = useState(null);
  useEffect(() => {
    let activo = true;
    const leer = (ruta) =>
      fetch(ruta)
        .then((r) => r.json())
        .then(lista)
        .catch(() => []);
    Promise.all(
      ['/api/dest/', '/api/churches/', '/api/sectional/', '/api/regional/'].map(leer)
    ).then(([dests, iglesias, secciones, regiones]) => {
      if (!activo) return;
      setDestacamentos(
        destacamentosDelMapa({
          destacamentos: dests,
          iglesias,
          secciones,
          regiones,
          provinciasDelMapa,
        })
      );
    });
    return () => {
      activo = false;
    };
  }, [provinciasDelMapa]);
  return destacamentos;
}

/** Nombre de la región → su logo (la foto de su ficha). Vacío mientras carga. */
export function useLogosDeRegiones() {
  const [logos, setLogos] = useState(() => new Map());
  useEffect(() => {
    let activo = true;
    getRegionals()
      .then((regiones) => {
        if (!activo) return;
        setLogos(
          new Map(
            (regiones || [])
              .filter((r) => r.avatarUrl)
              .map((r) => [String(r.name || r.regionalName || '').trim(), r.avatarUrl])
          )
        );
      })
      .catch(() => {});
    return () => {
      activo = false;
    };
  }, []);
  return logos;
}

/**
 * Lista flotante de destacamentos. `contenedor` es donde se pinta: en pantalla
 * completa solo se ve lo que está dentro del elemento a pantalla completa.
 */
export function ListaFlotante({ titulo, destacamentos = [], contenedor, children }) {
  if (!destacamentos.length) return children;
  const orden = [...destacamentos].sort((a, b) =>
    nombreDeDestacamento(a).localeCompare(nombreDeDestacamento(b), 'es', { numeric: true })
  );
  return (
    <Tooltip
      arrow
      enterTouchDelay={0}
      leaveTouchDelay={4000}
      slotProps={{ popper: { container: contenedor } }}
      title={
        <Box sx={{ py: 0.5 }}>
          <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
            {titulo} · {destacamentos.length}
          </Typography>
          <Box component="ul" sx={{ m: 0, pl: 2, maxHeight: 260, overflowY: 'auto' }}>
            {orden.map((d) => (
              <Typography component="li" variant="caption" key={d.id} sx={{ display: 'list-item' }}>
                {nombreDeDestacamento(d)}
              </Typography>
            ))}
          </Box>
        </Box>
      }
    >
      {children}
    </Tooltip>
  );
}

/** Un círculo con el número de destacamentos en cada provincia que tiene alguno. */
export function NumerosDeProvincias({ provincias, porProvincia, zoom, subir = 0, contenedor }) {
  const radio = 12 / Math.sqrt(zoom);
  return (
    <g data-testid="numeros-provincias">
      {provincias
        .filter((p) => porProvincia.get(p.nombre)?.length)
        .map((p) => {
          // El Distrito Nacional está dentro de Santo Domingo: su número se aparta
          // hacia el mar con una línea, como su nombre.
          const esDistrito = p.id === 'DO-01';
          const cx = p.posicion.x;
          const cy = p.posicion.y - subir + (esDistrito ? 34 : 0);
          return (
            <ListaFlotante
              key={p.id}
              titulo={p.nombre}
              destacamentos={porProvincia.get(p.nombre)}
              contenedor={contenedor}
            >
              <Box component="g" sx={{ cursor: 'pointer' }}>
                {esDistrito && (
                  <line
                    x1={p.posicion.x}
                    y1={p.posicion.y}
                    x2={cx}
                    y2={cy - radio}
                    stroke="#ffffff"
                    strokeWidth={0.8}
                    vectorEffect="non-scaling-stroke"
                  />
                )}
                <circle
                  cx={cx}
                  cy={cy}
                  r={radio}
                  fill="#ffffff"
                  stroke="#0a315c"
                  strokeWidth={1.6}
                  vectorEffect="non-scaling-stroke"
                />
                <text
                  x={cx}
                  y={cy}
                  dy={radio * 0.36}
                  textAnchor="middle"
                  fontSize={radio * 1.05}
                  fontWeight="700"
                  fill="#1C252E"
                >
                  {porProvincia.get(p.nombre).length}
                </text>
              </Box>
            </ListaFlotante>
          );
        })}
    </g>
  );
}

/**
 * Las cuatro regiones debajo del mapa, con su total. Señalar una la resalta en el
 * mapa (`onSenalar`) y enseña sus destacamentos.
 */
export function LeyendaDeRegiones({ porRegion, total, sinProvincia, onSenalar, contenedor, sx }) {
  const logos = useLogosDeRegiones();
  return (
    <Paper
      elevation={6}
      data-testid="leyenda-destacamentos-regiones"
      sx={{
        px: 2,
        py: 1.25,
        color: 'common.white',
        bgcolor: 'rgba(7, 31, 58, .92)',
        backdropFilter: 'blur(10px)',
        borderRadius: 2,
        ...sx,
      }}
    >
      <Stack direction="row" sx={{ gap: { xs: 1.5, sm: 3 }, justifyContent: 'center' }}>
        {REGIONES_RD.map((region) => {
          const suyos = porRegion.get(region.nombre) || [];
          return (
            <ListaFlotante
              key={region.nombre}
              titulo={region.nombre}
              destacamentos={suyos}
              contenedor={contenedor}
            >
              <Stack
                spacing={0.25}
                tabIndex={0}
                onMouseEnter={() => onSenalar(region.nombre)}
                onMouseLeave={() => onSenalar(null)}
                onFocus={() => onSenalar(region.nombre)}
                onBlur={() => onSenalar(null)}
                sx={{ alignItems: 'center', minWidth: 56, cursor: 'pointer', outline: 'none' }}
              >
                {/* El logo de la región con un aro de su color; sin logo, solo el color. */}
                {logos.get(region.nombre) ? (
                  <Box
                    component="img"
                    src={logos.get(region.nombre)}
                    alt={region.nombre}
                    sx={(theme) => ({
                      width: TAMANO_LOGO_REGION,
                      height: TAMANO_LOGO_REGION,
                      borderRadius: '50%',
                      objectFit: 'cover',
                      bgcolor: 'common.white',
                      border: `${ANCHO_ARO_LOGO}px solid ${theme.palette[region.color].main}`,
                    })}
                  />
                ) : (
                  <Box
                    sx={(theme) => ({
                      width: TAMANO_LOGO_REGION,
                      height: TAMANO_LOGO_REGION,
                      borderRadius: '50%',
                      bgcolor: `${region.color}.main`,
                      border: `${ANCHO_ARO_LOGO}px solid ${theme.palette.common.white}`,
                    })}
                  />
                )}
                <Typography variant="caption" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                  {region.nombre.replace('Región ', '')}
                </Typography>
                <Typography variant="caption" sx={{ opacity: 0.8, lineHeight: 1.2 }}>
                  {suyos.length} dest.
                </Typography>
              </Stack>
            </ListaFlotante>
          );
        })}
      </Stack>
      <Typography
        variant="caption"
        component="p"
        sx={{ mt: 0.75, textAlign: 'center', opacity: 0.7 }}
      >
        {total} destacamentos      </Typography>
    </Paper>
  );
}
