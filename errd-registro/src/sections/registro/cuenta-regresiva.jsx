'use client';

import { useState, useEffect } from 'react';
import { varAlpha } from 'minimal-shared/utils';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { fechaDeCierre, useCuentaRegresiva } from './use-cuenta-regresiva';

// ----------------------------------------------------------------------
// Cuenta atrás hasta el cierre de la actualización. La fecha, el texto y si se
// enseña se eligen en el dashboard (bandeja de actualizaciones) y llegan en vivo
// (ver use-cuenta-regresiva.js). Cuenta con la hora del servidor, en Santo
// Domingo, para que el plazo sea el mismo para todos.
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

export function CuentaRegresiva({ compacta = false }) {
  const { config, desfase, cargada } = useCuentaRegresiva();
  // null en el servidor: la hora del servidor y la del navegador no coinciden
  // y React avisaría de un desajuste al hidratar.
  const [ahora, setAhora] = useState(null);

  useEffect(() => {
    setAhora(Date.now());
    const id = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Oculta desde el dashboard: no se enseña nada.
  if (!config.mostrar) return null;

  const restante =
    ahora === null || !cargada ? null : Date.parse(config.cierre) - (ahora + desfase);

  if (restante !== null && restante <= 0) {
    return (
      <Typography variant="subtitle1" sx={{ opacity: 0.9, textAlign: { xs: 'center', md: 'left' } }}>
        El plazo de actualización terminó el {fechaDeCierre(config.cierre)}.
      </Typography>
    );
  }

  return (
    // Centrada en pantallas pequeñas; a la izquierda, con el texto, en las grandes.
    <Stack spacing={1} sx={{ alignItems: { xs: 'center', md: 'flex-start' }, textAlign: { xs: 'center', md: 'left' } }}>
      <Typography variant="subtitle2" sx={{ opacity: 0.85 }}>
        {config.texto}
      </Typography>
      <Stack direction="row" spacing={{ xs: 1, sm: 1.5 }}>
        {partes(restante ?? 0).map((p) => (
          <Box
            key={p.texto}
            sx={(t) => ({
              minWidth: compacta ? { xs: 64, sm: 70, md: 78 } : { xs: 70, md: 78 },
              py: 0.5,
              px: 1,
              textAlign: 'center',
              borderRadius: 1.5,
              bgcolor: varAlpha(t.vars.palette.common.whiteChannel, 0.12),
              border: `solid 1px ${varAlpha(t.vars.palette.common.whiteChannel, 0.2)}`,
            })}
          >
            <Typography variant="h3" sx={{ fontVariantNumeric: 'tabular-nums', lineHeight: 1.1, fontSize: compacta ? { xs: 34, sm: 40, md: 48 } : undefined }}>
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
