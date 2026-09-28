'use client';

import dayjs from 'dayjs';
import { useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import FormControlLabel from '@mui/material/FormControlLabel';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';

import {
  aIsoSantoDomingo,
  partesDeLoQueFalta,
  CUENTA_REGRESIVA_DE_FABRICA,
} from 'src/utils/cuenta-regresiva-landing.mjs';

import {
  guardarCuentaRegresiva,
  escucharCuentaRegresiva,
} from 'src/services/cuenta-regresiva-landing-service';

import { Label } from 'src/components/label';
import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------
// LA CUENTA ATRÁS DE LA PÁGINA DE REGISTRO, desde la bandeja.
//
// Se elige la fecha y la hora del cierre (en hora de Santo Domingo), si se
// enseña, su texto y si el formulario se cierra al llegar a cero. La landing lo
// aplica en unos segundos, sin publicar nada. Ver
// src/utils/cuenta-regresiva-landing.mjs.
// ----------------------------------------------------------------------

// El calendario trabaja en la hora del navegador; el cierre se guarda en la de
// Santo Domingo. Para que lo que se ve sea la hora dominicana, se "traslada" el
// instante al mostrarlo y al guardarlo.
const DESFASE_LOCAL_MIN = () => -new Date().getTimezoneOffset();
const aVista = (iso) => dayjs(iso).add(-4 * 60 - DESFASE_LOCAL_MIN(), 'minute');
const deVista = (valor) =>
  aIsoSantoDomingo(
    dayjs(valor)
      .add(4 * 60 + DESFASE_LOCAL_MIN(), 'minute')
      .toDate()
  );

const ATAJOS = [
  { etiqueta: '+1 día', dias: 1 },
  { etiqueta: '+7 días', dias: 7 },
];

function Contador({ cierreIso }) {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const restante = Date.parse(cierreIso) - ahora;
  const p = partesDeLoQueFalta(restante);
  if (restante <= 0) return <Label color="error">Plazo terminado</Label>;
  return (
    <Stack direction="row" spacing={1}>
      {[
        [p.dias, 'Días'],
        [p.horas, 'Horas'],
        [p.minutos, 'Minutos'],
        [p.segundos, 'Segundos'],
      ].map(([valor, texto]) => (
        <Box
          key={texto}
          sx={{
            minWidth: 64,
            py: 0.5,
            textAlign: 'center',
            borderRadius: 1,
            bgcolor: 'background.neutral',
          }}
        >
          <Typography variant="h6" sx={{ fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }}>
            {String(valor).padStart(2, '0')}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {texto}
          </Typography>
        </Box>
      ))}
    </Stack>
  );
}

export function CuentaRegresivaLandingCard({ user }) {
  const [guardada, setGuardada] = useState(null);
  const [borrador, setBorrador] = useState(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(
    () =>
      escucharCuentaRegresiva((config) => {
        setGuardada(config);
        // Lo que llega en vivo solo reemplaza el borrador si no se está editando.
        setBorrador((actual) => actual ?? config);
      }),
    []
  );

  if (!guardada || !borrador) return null;

  const cambiado =
    borrador.cierre !== guardada.cierre ||
    borrador.mostrar !== guardada.mostrar ||
    borrador.texto !== guardada.texto ||
    borrador.cerrarAlTerminar !== guardada.cerrarAlTerminar;
  const cambiar = (campo, valor) => setBorrador((b) => ({ ...b, [campo]: valor }));

  const guardar = async () => {
    if (Date.parse(borrador.cierre) <= Date.now() && borrador.mostrar) {
      toast.warning('Ese cierre ya pasó: la página mostrará el plazo como terminado.');
    }
    setGuardando(true);
    try {
      const resultado = await guardarCuentaRegresiva({
        valores: borrador,
        anterior: guardada,
        usuario: user,
      });
      toast.success(
        resultado?.estado === 'sin_cambios'
          ? 'No había cambios.'
          : 'Guardado: la página de registro lo aplica en unos segundos.'
      );
      setBorrador(null);
    } catch (error) {
      toast.error(error?.message || 'No se pudo guardar la cuenta atrás.');
    } finally {
      setGuardando(false);
    }
  };

  const quien = guardada.actualizadoPor?.nombre;
  const cuando = guardada.actualizadoEn
    ? dayjs(guardada.actualizadoEn).format('DD/MM/YYYY hh:mm A')
    : '';

  return (
    <Card sx={{ mb: 3, p: 3 }}>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={2}
        sx={{ mb: 2.5, justifyContent: 'space-between', alignItems: { md: 'center' } }}
      >
        <Box>
          <Typography variant="subtitle1">Cuenta atrás de la página de registro</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Hora de Santo Domingo. La página la aplica en unos segundos, sin publicar nada.
            {quien ? ` Último cambio: ${quien}${cuando ? `, ${cuando}` : ''}.` : ''}
          </Typography>
        </Box>
        <Contador cierreIso={borrador.cierre} />
      </Stack>

      <Box
        sx={{
          gap: 2.5,
          display: 'grid',
          alignItems: 'center',
          gridTemplateColumns: { xs: '1fr', md: '280px 1fr' },
        }}
      >
        <DateTimePicker
          label="Cierre (fecha y hora)"
          format="DD/MM/YYYY hh:mm A"
          ampm
          value={aVista(borrador.cierre)}
          onChange={(valor) => valor && dayjs(valor).isValid() && cambiar('cierre', deVista(valor))}
        />
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
          {ATAJOS.map((atajo) => (
            <Button
              key={atajo.etiqueta}
              size="small"
              variant="outlined"
              color="inherit"
              onClick={() =>
                cambiar(
                  'cierre',
                  aIsoSantoDomingo(Date.parse(borrador.cierre) + atajo.dias * 86400000)
                )
              }
            >
              {atajo.etiqueta}
            </Button>
          ))}
          <Button
            size="small"
            color="inherit"
            startIcon={<Iconify icon="solar:restart-bold" />}
            onClick={() => cambiar('cierre', CUENTA_REGRESIVA_DE_FABRICA.cierre)}
          >
            Cierre original (12/10 11:59 PM)
          </Button>
        </Stack>

        <TextField
          label="Texto encima de la cuenta"
          value={borrador.texto}
          onChange={(e) => cambiar('texto', e.target.value)}
          slotProps={{ htmlInput: { maxLength: 120 } }}
          sx={{ gridColumn: { md: '1 / -1' } }}
        />

        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          sx={{ gridColumn: { md: '1 / -1' } }}
        >
          <FormControlLabel
            control={
              <Switch checked={borrador.mostrar} onChange={(_, v) => cambiar('mostrar', v)} />
            }
            label="Mostrar la cuenta atrás en la página"
          />
          <FormControlLabel
            control={
              <Switch
                checked={borrador.cerrarAlTerminar}
                onChange={(_, v) => cambiar('cerrarAlTerminar', v)}
              />
            }
            label="Cerrar el formulario al llegar a cero"
          />
        </Stack>
      </Box>

      <Stack direction="row" spacing={1.5} sx={{ mt: 2.5, justifyContent: 'flex-end' }}>
        <Button
          color="inherit"
          disabled={!cambiado || guardando}
          onClick={() => setBorrador(guardada)}
        >
          Deshacer
        </Button>
        <Button variant="contained" disabled={!cambiado} loading={guardando} onClick={guardar}>
          Guardar y aplicar
        </Button>
      </Stack>
    </Card>
  );
}
