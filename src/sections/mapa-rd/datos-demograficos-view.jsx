'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import Skeleton from '@mui/material/Skeleton';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import { REGIONES_RD } from 'src/utils/regiones-de-provincias.mjs';
import { filterDestsByMemberScope } from 'src/utils/member-access';

import { azulLegible } from 'src/theme/azul-legible';
import { DashboardContent } from 'src/layouts/dashboard';
import { authHeaders } from 'src/services/member-service';

import { Iconify } from 'src/components/iconify';

import { useAuthContext } from 'src/auth/hooks';

import { useLogosDeRegiones } from './destacamentos-en-mapa';
import { DominicanRepublicMapDemo } from './dominican-republic-map-demo';
import { Serie, Genero, Edades, Regiones } from './datos-demograficos-graficos';
import { caja, numero, selector, fondoSuave } from './datos-demograficos-estilos';
import { Metrica, Categoria, PanelProvincia } from './datos-demograficos-componentes';
import {
  CATEGORIAS,
  resumirPadron,
  prepararPadron,
  nombresProvincias,
} from './estadisticas-demograficas.mjs';

export function DatosDemograficosView() {
  const { user } = useAuthContext();
  const logosRegiones = useLogosDeRegiones();
  const [padron, setPadron] = useState(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);
  const [filtros, setFiltros] = useState({
    periodo: String(new Date().getFullYear()),
    region: '',
    provincia: '',
    categoria: '',
    sexo: '',
  });
  const [detalleAbierto, setDetalleAbierto] = useState(true);
  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const headers = await authHeaders();
      const rutas = [
        '/api/dest/',
        '/api/churches/',
        '/api/sectional/',
        '/api/regional/',
        '/api/members/',
      ];
      const datos = await Promise.all(
        rutas.map(async (ruta) => {
          const respuesta = await fetch(ruta, { headers });
          if (!respuesta.ok) throw new Error(`${ruta} (${respuesta.status})`);
          return respuesta.json();
        })
      );
      const filas = (respuesta) =>
        Array.isArray(respuesta) ? respuesta : (respuesta?.data ?? respuesta?.Data ?? []);
      const destacamentos = filterDestsByMemberScope(filas(datos[0]), user, {
        churches: filas(datos[1]),
        sectionals: filas(datos[2]),
      });
      setPadron(
        prepararPadron({
          destacamentos,
          iglesias: datos[1],
          secciones: datos[2],
          regiones: datos[3],
          miembros: datos[4],
        })
      );
    } catch (e) {
      setError(`No se pudieron cargar las estadísticas: ${e.message}`);
    } finally {
      setCargando(false);
    }
  }, [user]);
  useEffect(() => {
    if (user) cargar();
  }, [cargar, user]);
  const cambiar = (campo, valor) =>
    setFiltros((actual) => ({
      ...actual,
      [campo]: valor,
      ...(campo === 'region' ? { provincia: '' } : {}),
    }));
  const resumen = useMemo(
    () => (padron ? resumirPadron(padron, filtros) : null),
    [padron, filtros]
  );
  const provincia =
    filtros.provincia ||
    (filtros.region ? REGIONES_RD.find((r) => r.nombre === filtros.region)?.provincias[0] : null) ||
    'Santo Domingo';
  const resumenProvincia = useMemo(
    () => (padron ? resumirPadron(padron, { ...filtros, provincia }) : null),
    [padron, filtros, provincia]
  );
  const provinciasVisibles = filtros.region
    ? REGIONES_RD.find((r) => r.nombre === filtros.region)?.provincias || []
    : nombresProvincias;
  const elegirProvincia = (nombre) => {
    setFiltros((actual) => ({
      ...actual,
      region: '',
      provincia: actual.provincia === nombre ? '' : nombre,
    }));
    setDetalleAbierto(true);
  };
  return (
    <DashboardContent maxWidth={false}>
      <Stack
        direction={{ xs: 'column', xl: 'row' }}
        sx={{ justifyContent: 'space-between', alignItems: { xl: 'center' }, gap: 2, mb: 2 }}
      >
        <Stack direction="row" sx={{ alignItems: 'center', gap: 1 }}>
          <Box
            sx={{
              width: 48,
              height: 48,
              flexShrink: 0,
              borderRadius: 1.5,
              display: 'grid',
              placeItems: 'center',
              color: 'primary.main',
              bgcolor: fondoSuave('primary'),
            }}
          >
            <Iconify icon="solar:users-group-rounded-linear" width={28} />
          </Box>
          <Box>
            <Typography component="h1" variant="h4">
              Datos demográficos
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Información estadística de nuestros destacamentos, miembros y distribución
              territorial.
            </Typography>
          </Box>
        </Stack>
        <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1, flex: { xl: '0 1 820px' } }}>
          <TextField
            select
            size="small"
            label="Período"
            value={filtros.periodo}
            onChange={(e) => cambiar('periodo', e.target.value)}
            sx={selector}
          >
            {[
              new Date().getFullYear(),
              new Date().getFullYear() - 1,
              new Date().getFullYear() - 2,
            ].map((ano) => (
              <MenuItem key={ano} value={String(ano)}>
                {ano}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            label="Región"
            value={filtros.region}
            onChange={(e) => cambiar('region', e.target.value)}
            sx={selector}
          >
            <MenuItem value="">Todas</MenuItem>
            {REGIONES_RD.map((r) => (
              <MenuItem key={r.nombre} value={r.nombre}>
                {r.nombre}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            label="Provincia"
            value={filtros.provincia}
            onChange={(e) => cambiar('provincia', e.target.value)}
            sx={selector}
          >
            <MenuItem value="">Todas</MenuItem>
            {provinciasVisibles.map((p) => (
              <MenuItem key={p} value={p}>
                {p}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            label="Edad / Categoría"
            value={filtros.categoria}
            onChange={(e) => cambiar('categoria', e.target.value)}
            sx={selector}
          >
            <MenuItem value="">Todas</MenuItem>
            {CATEGORIAS.map((c) => (
              <MenuItem key={c.id} value={c.id}>
                {c.nombre}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            label="Sexo"
            value={filtros.sexo}
            onChange={(e) => cambiar('sexo', e.target.value)}
            sx={selector}
          >
            <MenuItem value="">Todos</MenuItem>
            <MenuItem value="masculino">Masculino</MenuItem>
            <MenuItem value="femenino">Femenino</MenuItem>
            <MenuItem value="sin-dato">Sin dato</MenuItem>
          </TextField>
          <Button
            variant="contained"
            startIcon={<Iconify icon="solar:restart-linear" />}
            onClick={() =>
              setFiltros({
                periodo: String(new Date().getFullYear()),
                region: '',
                provincia: '',
                categoria: '',
                sexo: '',
              })
            }
            sx={{ whiteSpace: 'nowrap' }}
          >
            Restablecer filtros
          </Button>
        </Stack>
      </Stack>
      <Typography variant="caption" component="p" sx={{ color: 'text.disabled', mb: 1.5 }}>
        Las cifras principales muestran el padrón actual; el período se aplica a los registros
        mensuales.
      </Typography>
      {error && (
        <Alert
          severity="error"
          action={<Button onClick={cargar}>Reintentar</Button>}
          sx={{ mb: 2 }}
        >
          {error}
        </Alert>
      )}
      {cargando && !padron ? (
        <Stack spacing={2}>
          {[90, 90, 620, 180].map((alto, i) => (
            <Skeleton key={i} variant="rounded" height={alto} />
          ))}
        </Stack>
      ) : (
        resumen && (
          <>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: 'repeat(2, minmax(0, 1fr))',
                  md: 'repeat(4, minmax(0, 1fr))',
                },
                gap: 2,
                mb: 2,
              }}
            >
              <Metrica
                icono="solar:flag-linear"
                cantidad={numero(resumen.dests.length)}
                etiqueta="Destacamentos"
              />
              <Metrica
                icono="solar:users-group-rounded-linear"
                cantidad={numero(resumen.miembros.length)}
                etiqueta="Participantes registrados"
              />
              <Metrica
                icono="solar:buildings-3-linear"
                cantidad={numero(resumen.iglesias)}
                etiqueta="Iglesias"
              />
              <Metrica
                icono="solar:danger-triangle-linear"
                cantidad={numero(resumen.pendientes)}
                etiqueta="Fichas por completar"
                color="error"
              />
            </Box>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: 'repeat(2, minmax(0, 1fr))',
                  lg: 'repeat(5, minmax(0, 1fr))',
                },
                gap: 2,
                mb: 2,
              }}
            >
              {CATEGORIAS.map((item) => (
                <Categoria
                  key={item.id}
                  item={item}
                  cantidad={resumen.porCategoria[item.id]}
                  total={resumen.miembros.length}
                  activa={filtros.categoria === item.id}
                  onClick={() => cambiar('categoria', filtros.categoria === item.id ? '' : item.id)}
                />
              ))}
            </Box>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: '1fr',
                  lg: detalleAbierto ? 'minmax(0, 2.05fr) minmax(320px, 1fr)' : '1fr',
                },
                gap: 2,
                mb: 2,
              }}
            >
              <Box
                sx={{
                  position: 'relative',
                  // Más alto que la maqueta (455): el país es apaisado y con la leyenda
                  // de regiones y los interruptores encima apenas quedaba sitio para él.
                  height: { xs: 520, md: 640 },
                  borderRadius: 2,
                  boxShadow: (theme) => theme.vars.customShadows.card,
                  overflow: 'hidden',
                }}
              >
                <DominicanRepublicMapDemo
                  alto="100%"
                  datosDestacamentos={resumen.dests}
                  provinciaSeleccionada={filtros.provincia}
                  onSeleccionarProvincia={elegirProvincia}
                />
                <Stack
                  direction="row"
                  sx={{
                    position: 'absolute',
                    top: 16,
                    left: 16,
                    gap: 1,
                    alignItems: 'center',
                    color: 'common.white',
                    typography: 'subtitle2',
                    pointerEvents: 'none',
                  }}
                >
                  <Iconify icon="solar:map-point-linear" width={20} />
                  Distribución por provincia
                </Stack>
              </Box>
              {detalleAbierto && (
                <PanelProvincia
                  nombre={provincia}
                  resumen={resumenProvincia}
                  region={REGIONES_RD.find((r) => r.provincias.includes(provincia))}
                  imagenRegion={logosRegiones.get(
                    REGIONES_RD.find((r) => r.provincias.includes(provincia))?.nombre
                  )}
                  onCerrar={() => setDetalleAbierto(false)}
                />
              )}
            </Box>
            {!detalleAbierto && (
              <Button size="small" sx={{ mb: 1 }} onClick={() => setDetalleAbierto(true)}>
                Mostrar detalle provincial
              </Button>
            )}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: '1fr',
                  md: 'repeat(2, minmax(0, 1fr))',
                  xl: 'repeat(4, minmax(0, 1fr))',
                },
                gap: 2,
                mb: 2,
              }}
            >
              <Genero resumen={resumen} />
              <Edades resumen={resumen} />
              <Regiones
                resumen={resumen}
                onElegir={(nombre) => cambiar('region', filtros.region === nombre ? '' : nombre)}
              />
              <Serie
                resumen={resumen}
                periodo={filtros.periodo}
                onPeriodo={(valor) => cambiar('periodo', valor)}
              />
            </Box>
            <Box
              sx={{
                ...caja,
                bgcolor: fondoSuave('primary'),
                borderColor: 'transparent',
                boxShadow: 'none',
                p: 2,
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
              }}
            >
              <Iconify
                icon="solar:lightbulb-bolt-linear"
                width={28}
                sx={(theme) => ({ ...azulLegible(theme), flexShrink: 0 })}
              />
              <Typography variant="body2">
                <b>Insight del sistema</b>
                <br />
                {
                  resumen.porRegion.reduce((a, b) => (a.destacamentos >= b.destacamentos ? a : b))
                    .nombre
                }{' '}
                concentra la mayor cantidad de destacamentos en la selección.{' '}
                {resumen.sinCategoria
                  ? `${numero(resumen.sinCategoria)} miembros no tienen categoría determinable.`
                  : ''}
              </Typography>
            </Box>
          </>
        )
      )}
    </DashboardContent>
  );
}
