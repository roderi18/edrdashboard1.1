'use client';

import { useState, useEffect } from 'react';
import { varAlpha } from 'minimal-shared/utils';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { fechaDeCierre, useCuentaRegresiva } from './use-cuenta-regresiva';

// ----------------------------------------------------------------------
// Cuenta atrás hasta el cierre de las inscripciones. El mismo componente que la
// landing de registro de destacamentos (errd-registro): texto encima y cuatro
// casillas (días, horas, minutos, segundos). La fecha, el texto y si se enseña
// se eligen en el dashboard y llegan en vivo (use-cuenta-regresiva.js). Cuenta
// con la hora del servidor, en Santo Domingo, para que el plazo sea el mismo
// para todos. Aquí va sobre fondo claro: casillas en el azul de la casa.
// ----------------------------------------------------------------------

const partes = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return [
    { valor: Math.floor(s / 86400), texto: 'Días' },
    { valor: Math.floor((s % 86400) / 3600), texto: 'Horas' },
    { valor: Math.floor((s % 3600) / 60), texto: 'Minutos' },
    { valor: s % 60, texto: 'Segundos' },
  ];
};

export function CuentaRegresiva({ sx }) {
  const { config, desfase, cargada } = useCuentaRegresiva();
  // null en el servidor: la hora del servidor y la del navegador no coinciden
  // y React avisaría de un desajuste al hidratar.
  const [ahora, setAhora] = useState(null);

  useEffect(() => {
    setAhora(Date.now());
    const id = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Sin fecha de cierre, u oculta desde el dashboard: no se enseña nada.
  if (!cargada || !config.fecha || !config.mostrar) return null;

  const restante = ahora === null ? null : Date.parse(config.fecha) - (ahora + desfase);

  if (restante !== null && restante <= 0) {
    return (
      <Typography variant="subtitle1" sx={{ color: 'error.main', ...sx }}>
        Las inscripciones cerraron el {fechaDeCierre(config.fecha)}.
      </Typography>
    );
  }

  return (
    <Stack spacing={1} sx={{ alignItems: 'flex-start', ...sx }}>
      <Typography variant="subtitle2" sx={{ color: 'text.secondary' }}>
        {config.texto}
      </Typography>
      <Stack direction="row" spacing={{ xs: 1, sm: 1.5 }}>
        {partes(restante ?? 0).map((p) => (
          <Box
            key={p.texto}
            sx={(t) => ({
              minWidth: { xs: 64, sm: 72 },
              py: 0.5,
              px: 1,
              textAlign: 'center',
              borderRadius: 1.5,
              color: 'primary.darker',
              bgcolor: varAlpha(t.vars.palette.primary.mainChannel, 0.08),
              border: `solid 1px ${varAlpha(t.vars.palette.primary.mainChannel, 0.2)}`,
              ...t.applyStyles('dark', {
                color: 'common.white',
                bgcolor: varAlpha(t.vars.palette.common.whiteChannel, 0.08),
                borderColor: varAlpha(t.vars.palette.common.whiteChannel, 0.2),
              }),
            })}
          >
            <Typography
              variant="h3"
              sx={{
                fontVariantNumeric: 'tabular-nums',
                lineHeight: 1.1,
                fontSize: { xs: 30, md: 36 },
              }}
            >
              {restante === null ? '--' : String(p.valor).padStart(2, '0')}
            </Typography>
            <Typography variant="caption" sx={{ display: 'block', fontSize: 11, opacity: 0.8 }}>
              {p.texto}
            </Typography>
          </Box>
        ))}
      </Stack>
    </Stack>
  );
}
