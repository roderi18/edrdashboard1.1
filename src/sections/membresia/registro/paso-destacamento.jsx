'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Autocomplete from '@mui/material/Autocomplete';
import InputAdornment from '@mui/material/InputAdornment';

import { Label } from 'src/components/label';
import { Iconify } from 'src/components/iconify';

import { CabeceraPaso } from './marco-registro';
import { PASOS, useRegistro, nombreDeDestacamento } from './contexto-registro';

// ----------------------------------------------------------------------
// PASO 1 · EL DESTACAMENTO. Se elige del censo (nadie escribe "Dest. 025"):
// número, nombre, región, sección, iglesia, pastor y coordinador salen de la
// base de datos y no se editan aquí. Las cuatro compuertas se ven antes de
// seguir; si alguna falla, no se puede continuar.
// ----------------------------------------------------------------------

const VALIDACIONES = [
  ['existe', 'Existe en el censo'],
  ['jurisdiccion', 'Jurisdicción correcta'],
  ['activo', 'Estatus activo'],
  ['sinMembresia', 'Sin membresía 2027 previa'],
];

// Busca por número exacto o por cualquier parte del nombre, sin tildes.
const normalizar = (texto) =>
  String(texto || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

const filtrar = (opciones, { inputValue }) => {
  const q = normalizar(inputValue).replace(/^(destacamento|dest\.?|#)\s*/, '');
  if (!q) return opciones.slice(0, 80);
  const porNumero = opciones.filter(
    (d) => normalizar(d.numero).replace(/^0+/, '') === q.replace(/^0+/, '')
  );
  const porTexto = opciones.filter(
    (d) => !porNumero.includes(d) && normalizar(`${d.numero} ${d.nombre} ${d.seccion}`).includes(q)
  );
  return [...porNumero, ...porTexto].slice(0, 80);
};

function Dato({ titulo, valor, md = 4 }) {
  return (
    <Grid size={{ xs: 12, sm: 6, md }}>
      <TextField
        fullWidth
        label={titulo}
        value={valor || 'No registrado'}
        variant="filled"
        slotProps={{ input: { readOnly: true }, inputLabel: { shrink: true } }}
        sx={{
          '& .MuiFilledInput-input': {
            color: valor ? 'text.primary' : 'text.disabled',
          },
        }}
      />
    </Grid>
  );
}

export function PasoDestacamento() {
  const router = useRouter();
  const {
    catalogo,
    errorCatalogo,
    destacamentoId,
    elegibilidad,
    cargandoElegibilidad,
    errorElegibilidad,
    elegirDestacamento,
    recargarElegibilidad,
  } = useRegistro();

  const opciones = useMemo(() => catalogo || [], [catalogo]);
  const elegido = opciones.find((d) => d.id === destacamentoId) || null;
  const d = elegibilidad?.destacamento;

  return (
    <Card sx={{ p: { xs: 2.5, md: 4 } }}>
      <CabeceraPaso
        indice={0}
        titulo="Selecciona tu destacamento"
        texto="Búscalo por número oficial o por nombre."
      />

      {errorCatalogo && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {errorCatalogo}
        </Alert>
      )}

      <Autocomplete
        options={opciones}
        value={elegido}
        loading={!catalogo}
        filterOptions={filtrar}
        onChange={(_, valor) => elegirDestacamento(valor?.id || null)}
        getOptionLabel={nombreDeDestacamento}
        isOptionEqualToValue={(a, b) => a.id === b.id}
        noOptionsText="No hay destacamentos con ese número o nombre"
        loadingText="Cargando el censo…"
        renderOption={({ key, ...props }, opcion) => (
          <li key={key} {...props}>
            <Box>
              <Typography variant="subtitle2">{nombreDeDestacamento(opcion)}</Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {[opcion.region, opcion.seccion].filter(Boolean).join(' · ') || 'Sin jurisdicción'}
              </Typography>
            </Box>
          </li>
        )}
        renderInput={(params) => (
          <TextField
            {...params}
            label="Buscar destacamento"
            placeholder="Ingresa número o nombre del destacamento…"
            // Este Autocomplete aún entrega `InputProps` (no `slotProps`).
            InputProps={{
              ...params.InputProps,
              startAdornment: (
                <InputAdornment position="start">
                  <Iconify icon="eva:search-fill" sx={{ color: 'text.disabled' }} />
                </InputAdornment>
              ),
            }}
          />
        )}
      />

      {destacamentoId && (
        <Card variant="outlined" sx={{ mt: 3 }}>
          <Box sx={{ px: 2.5, py: 1.5, bgcolor: 'background.neutral' }}>
            <Typography variant="subtitle1">Información del destacamento</Typography>
          </Box>
          <Box sx={{ p: 2.5 }}>
            {cargandoElegibilidad && (
              <Grid container spacing={2}>
                {Array.from({ length: 8 }, (_, i) => (
                  <Grid key={i} size={{ xs: 12, sm: 6, md: i < 2 ? 6 : 4 }}>
                    <Skeleton variant="rounded" height={56} />
                  </Grid>
                ))}
              </Grid>
            )}

            {errorElegibilidad && (
              <Alert
                severity="error"
                action={
                  <Button color="inherit" size="small" onClick={recargarElegibilidad}>
                    Reintentar
                  </Button>
                }
              >
                {errorElegibilidad}
              </Alert>
            )}

            {d && !cargandoElegibilidad && (
              <>
                <Grid container spacing={2}>
                  <Dato titulo="Número oficial" valor={d.numero} md={3} />
                  <Dato titulo="Nombre" valor={d.nombre} md={9} />
                  <Dato titulo="Región" valor={d.region} />
                  <Dato titulo="Sección" valor={d.seccion} />
                  <Dato titulo="Iglesia" valor={d.iglesia} />
                  <Dato
                    titulo="Estatus"
                    valor={elegibilidad.validaciones?.activo ? 'Habilitado 2027' : 'No habilitado'}
                  />
                  <Dato titulo="Coordinador(a)" valor={d.coordinador} />
                  <Dato titulo="Pastor(a) o pareja pastoral" valor={d.pastor} />
                </Grid>

                <Stack direction="row" sx={{ mt: 2.5, gap: 1, flexWrap: 'wrap' }}>
                  {VALIDACIONES.map(([clave, texto]) => {
                    const ok = elegibilidad.validaciones?.[clave];
                    return (
                      <Label
                        key={clave}
                        color={ok ? 'success' : 'error'}
                        startIcon={
                          <Iconify
                            icon={ok ? 'solar:check-circle-bold' : 'solar:close-circle-bold'}
                          />
                        }
                        sx={{ height: 32, px: 1.5 }}
                      >
                        {texto}
                      </Label>
                    );
                  })}
                </Stack>

                {!elegibilidad.disponible && (
                  <Alert severity="error" sx={{ mt: 2.5 }}>
                    {elegibilidad.motivo}
                  </Alert>
                )}

                {elegibilidad.disponible && (!d.coordinador || !d.pastor) && (
                  <Alert severity="warning" sx={{ mt: 2.5 }}>
                    Falta el {!d.coordinador ? 'coordinador(a)' : 'pastor(a)'} en el registro de tu
                    destacamento. Saldrá en blanco en el certificado: pide a la Oficina Nacional que
                    lo actualice antes de pagar.
                  </Alert>
                )}
              </>
            )}
          </Box>
        </Card>
      )}

      <Stack direction="row" sx={{ mt: 4, justifyContent: 'flex-end' }}>
        <Button
          size="large"
          variant="contained"
          disabled={!elegibilidad?.disponible || cargandoElegibilidad}
          endIcon={<Iconify icon="eva:arrow-forward-fill" />}
          onClick={() => router.push(PASOS[1].ruta)}
        >
          Continuar al plan
        </Button>
      </Stack>
    </Card>
  );
}
