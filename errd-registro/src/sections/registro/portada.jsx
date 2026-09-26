'use client';

import { useMemo } from 'react';
import { varAlpha } from 'minimal-shared/utils';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';

import { mismoNombre } from './catalogo';
import { MAPA_ALTO, MAPA_ANCHO, PROVINCIAS as PROVINCIAS_MAPA } from './mapa-provincias';

// ----------------------------------------------------------------------
// Cabecera, portada (16:9 en pantallas grandes) y pie de la landing.
// Sin inicio de sesión ni usuario: es una página pública.
// ----------------------------------------------------------------------

const Marca = ({ claro = false }) => (
  <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', color: claro ? 'common.white' : 'text.primary' }}>
    <Box component="img" alt="Exploradores del Rey" src="/logo/emblema-erd.png" sx={{ width: 44, height: 44 }} />
    <Box>
      <Typography variant="subtitle1" sx={{ lineHeight: 1.1, fontWeight: 800, letterSpacing: 0.5 }}>
        EXPLORADORES DEL REY
      </Typography>
      <Typography variant="caption" sx={{ opacity: 0.8, letterSpacing: 1 }}>
        EVANGELIZAR · EQUIPAR · EMPODERAR
      </Typography>
    </Box>
  </Stack>
);

export function Encabezado() {
  return (
    <Box
      component="header"
      sx={(t) => ({ bgcolor: t.vars.palette.primary.darker, color: 'common.white', py: 1.5 })}
    >
      <Container maxWidth="xl">
        <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
          <Marca claro />
          <Stack direction="row" spacing={3} sx={{ display: { xs: 'none', md: 'flex' } }}>
            {[
              ['Inicio', '#inicio'],
              ['Registrar destacamento', '#registrar'],
            ].map(([t, href]) => (
              <Link key={href} href={href} color="inherit" underline="hover" variant="subtitle2">
                {t}
              </Link>
            ))}
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
}

// Provincia del catálogo -> nombre en el mapa (dos se escriben distinto).
const EN_MAPA = { baoruco: 'Bahoruco', 'sanchez ramirez': 'Sánchez Ramírez' };

// Región de cada provincia (nombres del mapa), según dónde están hoy sus
// destacamentos; las que aún no tienen ninguno, por cercanía.
const REGIONES = [
  {
    nombre: 'Región Norte',
    color: 'info',
    provincias: ['Monte Cristi', 'Dajabón', 'Santiago Rodríguez', 'Valverde', 'Santiago', 'Puerto Plata',
      'Espaillat', 'La Vega', 'Duarte', 'Hermanas Mirabal', 'María Trinidad Sánchez', 'Samaná', 'Sánchez Ramírez'],
  },
  {
    nombre: 'Región Central',
    color: 'success',
    provincias: ['Distrito Nacional', 'Santo Domingo', 'Monte Plata', 'Monseñor Nouel'],
  },
  {
    nombre: 'Región Sur',
    color: 'warning',
    provincias: ['Azua', 'Bahoruco', 'Barahona', 'Elías Piña', 'Independencia', 'Pedernales', 'Peravia',
      'San Cristóbal', 'San Juan', 'San José de Ocoa'],
  },
  {
    nombre: 'Región Este',
    color: 'error',
    provincias: ['El Seibo', 'Hato Mayor', 'La Altagracia', 'La Romana', 'San Pedro de Macorís'],
  },
];
const regionDe = (provincia) => REGIONES.find((r) => r.provincias.some((x) => mismoNombre(x, provincia)));

function MapaRD({ destacamentos }) {
  const porProvincia = useMemo(() => {
    const cuenta = new Map();
    destacamentos.forEach((d) => {
      const p = d.direccion?.provincia;
      if (!p) return;
      const clave = EN_MAPA[p.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')] || p;
      const prov = PROVINCIAS_MAPA.find((x) => mismoNombre(x.nombre, clave));
      if (prov) cuenta.set(prov.nombre, (cuenta.get(prov.nombre) || 0) + 1);
    });
    return cuenta;
  }, [destacamentos]);

  return (
    <Box
      component="svg"
      viewBox={`-10 -10 ${MAPA_ANCHO + 20} ${MAPA_ALTO + 20}`}
      role="img"
      aria-label="Mapa de destacamentos por provincia"
      sx={{ width: 1, height: 'auto', filter: 'drop-shadow(0 12px 24px rgba(0,0,0,.45))' }}
    >
      {PROVINCIAS_MAPA.map((p) => (
        <Box
          component="path"
          key={p.nombre}
          d={p.d}
          sx={(t) => ({
            fill: t.vars.palette[regionDe(p.nombre)?.color || 'grey']?.main ?? t.vars.palette.grey[500],
            fillOpacity: porProvincia.get(p.nombre) ? 0.9 : 0.5,
            stroke: t.vars.palette.common.white,
            strokeOpacity: 0.6,
            strokeWidth: 1.2,
          })}
        >
          <title>{`${p.nombre} (${regionDe(p.nombre)?.nombre || 'Sin región'}): ${porProvincia.get(p.nombre) || 0} destacamentos`}</title>
        </Box>
      ))}
      {PROVINCIAS_MAPA.filter((p) => porProvincia.get(p.nombre)).map((p) => (
        <g key={`pin-${p.nombre}`} transform={`translate(${p.centro[0]} ${p.centro[1]})`}>
          <Box component="circle" r={14} sx={(t) => ({ fill: t.vars.palette.warning.main, stroke: '#fff', strokeWidth: 3 })} />
          <text textAnchor="middle" dy="5" fontSize="14" fontWeight="700" fill="#1C252E">
            {porProvincia.get(p.nombre)}
          </text>
        </g>
      ))}
    </Box>
  );
}

/** El mapa con la leyenda de regiones y el total: el de la portada, y el de la
 *  ventana "Ver mapa de Destacamentos" en el móvil (donde la portada lo oculta). */
export function MapaDestacamentos({ destacamentos, secciones = [] }) {
  const iconoDeRegion = new Map(secciones.filter((s) => s.fotoRegion).map((s) => [s.region, s.fotoRegion]));
  return (
    <Box sx={{ position: 'relative' }}>
    <MapaRD destacamentos={destacamentos} />
    {/* Encima del mapa, en el hueco del mar bajo el sur y el este. */}
    <Stack
      direction="row"
      sx={{ gap: 1.5, justifyContent: 'center', position: 'absolute', left: '30%', right: 0, bottom: '2%' }}
    >
      {REGIONES.map((r) => (
        <Stack key={r.nombre} spacing={0.25} sx={{ alignItems: 'center', minWidth: 56 }}>
          {iconoDeRegion.get(r.nombre) ? (
            <Box
              component="img"
              src={iconoDeRegion.get(r.nombre)}
              alt={r.nombre}
              sx={(t) => ({
                width: 44,
                height: 44,
                borderRadius: '50%',
                objectFit: 'cover',
                border: `2px solid ${t.vars.palette[r.color].main}`,
              })}
            />
          ) : (
            <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: `${r.color}.main` }} />
          )}
          <Typography variant="caption" sx={{ color: 'common.white', fontWeight: 600, lineHeight: 1.2 }}>
            {r.nombre.replace('Región ', '')}
          </Typography>
          <Typography variant="caption" sx={{ color: 'common.white', opacity: 0.8, lineHeight: 1.2 }}>
            {destacamentos.filter((d) => d.region === r.nombre).length} dest.
          </Typography>
        </Stack>
      ))}
    </Stack>
    <Card
      sx={(t) => ({
        p: 2,
        top: 0,
        right: 0,
        position: 'absolute',
        color: 'common.white',
        bgcolor: `${varAlpha(t.vars.palette.primary.darkerChannel, 0.8)}`,
        border: `solid 1px ${varAlpha(t.vars.palette.primary.lightChannel, 0.4)}`,
      })}
    >
      <Typography variant="h3">{destacamentos.length || '—'}</Typography>
      <Typography variant="caption" sx={{ opacity: 0.8 }}>
        Destacamentos registrados
      </Typography>
    </Card>
    </Box>
  );
}

export function Portada({ destacamentos, secciones = [] }) {
  return (
    <Box
      id="inicio"
      sx={(t) => ({
        position: 'relative',
        color: 'common.white',
        overflow: 'hidden',
        // Una franja baja (38% del ancho, hasta 540 px) para que el formulario se
        // vea sin bajar tanto. Con aspect-ratio + max-height el navegador
        // estrechaba la portada, por eso va con height.
        height: { lg: 'min(38vw, 540px)' },
        display: 'flex',
        alignItems: 'center',
        py: { xs: 6, lg: 0 },
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundImage: {
          xs: `linear-gradient(180deg, ${varAlpha(t.vars.palette.primary.darkerChannel, 0.93)}, ${varAlpha(t.vars.palette.primary.darkerChannel, 0.67)}), url(/fotos/campamento-movil.webp)`,
          md: `linear-gradient(90deg, ${varAlpha(t.vars.palette.primary.darkerChannel, 0.95)} 0%, ${varAlpha(t.vars.palette.primary.darkerChannel, 0.7)} 45%, ${varAlpha(t.vars.palette.primary.darkerChannel, 0.25)} 100%), url(/fotos/campamento-monitor-1920.webp)`,
        },
      })}
    >
      <Container maxWidth="xl">
        <Box sx={{ gap: 4, display: 'grid', alignItems: 'center', gridTemplateColumns: { xs: '1fr', md: '1.1fr 1fr' } }}>
          <Stack spacing={3}>

            <Typography variant="h2" sx={{ fontSize: { xs: 34, md: 48, lg: 56 }, lineHeight: 1.1 }}>
             Cada Destacamento cuenta{' '}
              <Box component="span" sx={{ color: 'primary.light' }}>
                en cada rincón de la República Dominicana
              </Box>
            </Typography>
            <Typography sx={{ opacity: 0.85, maxWidth: 600 }}>
Registra o actualiza la información de tu destacamento y ayúdanos a tener un registro nacional completo y al día.
            </Typography>
          </Stack>

          <Box sx={{ position: 'relative', display: { xs: 'none', md: 'block' }, maxWidth: 620, justifySelf: 'end', width: 1 }}>
            <MapaDestacamentos destacamentos={destacamentos} secciones={secciones} />
          </Box>
        </Box>
      </Container>
    </Box>
  );
}

export function Pie() {
  return (
    <Box id="contacto" component="footer" sx={(t) => ({ bgcolor: t.vars.palette.primary.darker, color: 'common.white', py: 5, mt: { xs: 4, md: 6 } })}>
      <Container maxWidth="xl">
        {/* La marca y el aviso de derechos, centrados. */}
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={4} sx={{ justifyContent: 'center', alignItems: 'center' }}>
          <Marca claro />
          {/* En pantallas anchas la frase se parte en varias líneas a la derecha,
              en vez de estirarse en una sola. */}
          {/* <Typography
            sx={{
              fontStyle: 'italic',
              typography: 'h6',
              fontWeight: 400,
              opacity: 0.9,
              maxWidth: { md: 440 },
              textAlign: { md: 'right' },
            }}
          >
            Influir en la vida de más niños y jóvenes que nunca, de una manera más efectiva que nunca.
          </Typography> */}
        </Stack>
        <Typography variant="caption" sx={{ display: 'block', mt: 1, opacity: 0.6, textAlign: 'center' }}>
          © {new Date().getFullYear()} Exploradores del Rey. Todos los derechos reservados.
        </Typography>
      </Container>
    </Box>
  );
}
