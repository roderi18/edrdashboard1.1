'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import Skeleton from '@mui/material/Skeleton';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Autocomplete from '@mui/material/Autocomplete';
import InputAdornment from '@mui/material/InputAdornment';

import { Label } from 'src/components/label';
import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';

import { QuienCorrige } from './quien-corrige';
import { CabeceraPaso } from './marco-registro';
import { BotonAvisarOficina } from './avisar-oficina';
import { PASOS, useRegistro, nombreDeDestacamento } from './contexto-registro';

// ----------------------------------------------------------------------
// PASO 1 · EL DESTACAMENTO. Se elige del censo (nadie escribe "Dest. 025"):
// número, nombre, región, sección, iglesia, pastor y coordinador salen de la
// base de datos y no se editan aquí. Las cuatro compuertas se ven antes de
// seguir; si alguna falla, no se puede continuar.
// ----------------------------------------------------------------------

// Se muestran solo las que el destacamento puede no cumplir. Existir en el
// censo es seguro (se eligió de él) y la jurisdicción, si falta, ya bloquea
// con su motivo: sus dos marcas no decían nada.
// [clave, texto si la cumple (verde), texto si no (rojo)]. El estatus va
// aparte: un destacamento inactivo también paga.
const VALIDACIONES = [['sinMembresia', 'Sin membresía 2027 previa', 'Ya tiene membresía 2027']];

// Busca por número exacto o por cualquier parte del nombre, sin tildes.
const normalizar = (texto) =>
  String(texto || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

const filtrar = (opciones, { inputValue }) => {
  const q = normalizar(inputValue).replace(/^(destacamento|dest\.?|#)\s*/, '');
  // Todos: el censo entero cabe (unos 300) y la lista se desplaza.
  const porNumero = opciones.filter(
    (d) => normalizar(d.numero).replace(/^0+/, '') === q.replace(/^0+/, '')
  );
  const porTexto = opciones.filter(
    (d) => !porNumero.includes(d) && normalizar(`${d.numero} ${d.nombre} ${d.seccion}`).includes(q)
  );
  if (!q) return opciones;
  return [...porNumero, ...porTexto];
};

// Un dato del padrón. Con "Corregir datos" se puede escribir; lo cambiado se
// marca en amarillo y enseña el valor original.
// [campo, título, ancho en escritorio]: los que se pueden corregir.
const CAMPOS = [
  ['numero', 'Número oficial', 3],
  ['nombre', 'Nombre', 9],
  ['region', 'Región', 4],
  ['seccion', 'Sección', 4],
  ['iglesia', 'Iglesia', 4],
  ['coordinador', 'Coordinador(a)', 4],
  ['pastor', 'Pastor(a) o pareja pastoral', 4],
];

// Región y sección se eligen de la lista de la API (no se escriben).
function Dato({ titulo, valor, md = 4, editable = false, original, onCambiar, opciones }) {
  const cambiado =
    editable && original !== undefined && String(valor ?? '') !== String(original ?? '');
  if (editable) {
    return (
      <Grid size={{ xs: 12, sm: 6, md }}>
        <TextField
          fullWidth
          label={titulo}
          value={valor ?? ''}
          color="primary"
          focused={cambiado || undefined}
          onChange={(e) => onCambiar(e.target.value)}
          helperText={cambiado ? `Antes: ${original || 'No registrado'}` : ' '}
          slotProps={{ inputLabel: { shrink: true } }}
          select={!!opciones}
        >
          {opciones &&
            (opciones.length ? (
              // El valor de hoy siempre está, aunque la API ya no lo traiga.
              [...new Set([valor, ...opciones].filter(Boolean))].map((opcion) => (
                <MenuItem key={opcion} value={opcion}>
                  {opcion}
                </MenuItem>
              ))
            ) : (
              <MenuItem value={valor ?? ''} disabled>
                Cargando…
              </MenuItem>
            ))}
        </TextField>
      </Grid>
    );
  }
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
    correcciones,
    corregir,
    descartarCorrecciones,
    corregidoPor,
    setCorregidoPor,
  } = useRegistro();
  const [editando, setEditando] = useState(false);
  // Regiones y secciones de la API, para sus desplegables (al empezar a corregir).
  const [jurisdicciones, setJurisdicciones] = useState(null);
  useEffect(() => {
    if (!editando || jurisdicciones) return;
    fetch('/api/jurisdicciones/')
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then(setJurisdicciones)
      .catch(() => setJurisdicciones({ regiones: [], secciones: [] }));
  }, [editando, jurisdicciones]);
  // Al guardar lo corregido se pregunta quién lo corrige (y adónde llamarle).
  const [pidiendoQuien, setPidiendoQuien] = useState(false);
  // Tras decir quién corrige, se sigue a lo que se estaba haciendo.
  const [despues, setDespues] = useState(null);
  const hayCambios = Object.keys(correcciones).length > 0;
  const regionActual =
    'region' in correcciones ? correcciones.region : elegibilidad?.destacamento?.region;
  const opcionesDe = (campo) => {
    if (campo === 'region') return jurisdicciones?.regiones || [];
    if (campo === 'seccion') {
      return (jurisdicciones?.secciones || [])
        .filter((x) => !regionActual || x.region === regionActual)
        .map((x) => x.nombre);
    }
    return undefined;
  };

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
                  {CAMPOS.map(([campo, titulo, md]) => (
                    <Dato
                      key={campo}
                      titulo={titulo}
                      md={md}
                      editable={editando}
                      original={d[campo]}
                      valor={campo in correcciones ? correcciones[campo] : d[campo]}
                      opciones={opcionesDe(campo)}
                      onCambiar={(v) => {
                        corregir(campo, v);
                        // Otra región: la sección de antes ya no le pertenece.
                        if (campo === 'region') {
                          const seccion =
                            'seccion' in correcciones ? correcciones.seccion : d.seccion;
                          const sigue = jurisdicciones?.secciones.some(
                            (x) => x.nombre === seccion && x.region === v
                          );
                          if (!sigue) corregir('seccion', '');
                        }
                      }}
                    />
                  ))}
                  <Dato titulo="Estatus" valor={elegibilidad.activo ? 'Activo' : 'Inactivo'} />
                </Grid>

                {hayCambios && (
                  <Alert
                    severity="info"
                    icon={<Iconify icon="solar:pen-bold" />}
                    sx={{ mt: 2.5 }}
                    action={
                      <Button
                        color="inherit"
                        size="small"
                        onClick={() => {
                          descartarCorrecciones();
                          setEditando(false);
                        }}
                      >
                        Deshacer
                      </Button>
                    }
                  >
                    Corregiste{' '}
                    {Object.keys(correcciones).length === 1
                      ? 'un dato'
                      : `${Object.keys(correcciones).length} datos`}{' '}
                    del destacamento. Puedes pagar igual, pero tu pago quedará{' '}
                    <strong>en revisión</strong> hasta que la Oficina Nacional confirme los cambios.
                    Te avisaremos por correo; después recibirás el certificado y la factura con los
                    datos correctos.
                  </Alert>
                )}

                <Stack direction="row" sx={{ mt: 2.5, gap: 1, flexWrap: 'wrap' }}>
                  {/* Informativo: inactivo no impide pagar. */}
                  <Label
                    color={elegibilidad.activo ? 'success' : 'default'}
                    startIcon={
                      <Iconify
                        icon={
                          elegibilidad.activo ? 'solar:check-circle-bold' : 'solar:info-circle-bold'
                        }
                      />
                    }
                    sx={{ height: 32, px: 1.5 }}
                  >
                    {elegibilidad.activo ? 'Estatus activo' : 'Estatus inactivo'}
                  </Label>
                  {VALIDACIONES.map(([clave, textoSi, textoNo]) => {
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
                        {ok ? textoSi : textoNo}
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

      <Stack
        direction={{ xs: 'column-reverse', md: 'row' }}
        spacing={2}
        sx={{ mt: 4, justifyContent: 'flex-end', alignItems: { md: 'center' } }}
      >
        {/* Algún dato no es correcto: se puede corregir (el pago quedará en revisión). */}
        {d && !cargandoElegibilidad && elegibilidad.disponible && (
          <Button
            size="large"
            variant="outlined"
            color="primary"
            startIcon={<Iconify icon={editando ? 'eva:checkmark-fill' : 'solar:pen-bold'} />}
            onClick={() => {
              if (!editando) setEditando(true);
              else if (hayCambios) {
                setDespues(null);
                setPidiendoQuien(true);
              } else setEditando(false);
            }}
          >
            {editando ? 'Guardar corrección' : 'Algún dato no es correcto'}
          </Button>
        )}
        {/* No puede pagar, por el motivo que sea: puede avisar a la Oficina Nacional. */}
        {d && !cargandoElegibilidad && !elegibilidad.disponible && (
          <BotonAvisarOficina key={d.id} destacamento={d} />
        )}
        <Button
          size="large"
          variant="contained"
          disabled={!elegibilidad?.disponible || cargandoElegibilidad}
          endIcon={<Iconify icon="eva:arrow-forward-fill" />}
          onClick={() => {
            // Con cambios y sin decir quién los hizo, primero eso.
            if (hayCambios && !corregidoPor) {
              setDespues('continuar');
              setPidiendoQuien(true);
              return;
            }
            setEditando(false);
            router.push(PASOS[1].ruta);
          }}
        >
          Continuar al plan
        </Button>
      </Stack>
      <QuienCorrige
        key={pidiendoQuien ? 'abierto' : 'cerrado'}
        abierto={pidiendoQuien}
        inicial={corregidoPor}
        onCancelar={() => setPidiendoQuien(false)}
        onGuardar={(quien) => {
          setCorregidoPor(quien);
          setPidiendoQuien(false);
          setEditando(false);
          toast.success('Cambios guardados. Tu pago quedará en revisión por la Oficina Nacional.');
          if (despues === 'continuar') router.push(PASOS[1].ruta);
        }}
      />
    </Card>
  );
}
