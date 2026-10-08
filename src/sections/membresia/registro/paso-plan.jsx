'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import Card from '@mui/material/Card';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';

import { Iconify } from 'src/components/iconify';

import { TarjetaPlan } from '../tarjeta-plan';
import { CabeceraPaso } from './marco-registro';
import { PASOS, useRegistro } from './contexto-registro';

// ----------------------------------------------------------------------
// PASO 2 · EL PLAN. Solo aparecen los planes que le tocan al destacamento (lo
// decide el servidor con el registro 2026 y la licencia RRI TRaC); el
// destacamento elige entre ellos, nunca se pone un descuento a mano.
// ----------------------------------------------------------------------

// Sin destacamento válido no hay plan que elegir: se vuelve al paso 1.
export function useExigirDestacamento() {
  const router = useRouter();
  const { restaurado, cargandoElegibilidad, elegibilidad } = useRegistro();
  const listo = restaurado && !cargandoElegibilidad;
  useEffect(() => {
    if (listo && !elegibilidad?.disponible) router.replace(PASOS[0].ruta);
  }, [listo, elegibilidad, router]);
  return listo && elegibilidad?.disponible;
}

export function PasoPlan() {
  const router = useRouter();
  const { planes, plan, elegirPlan, elegibilidad } = useRegistro();
  const listo = useExigirDestacamento();

  return (
    <Card sx={{ p: { xs: 2.5, md: 4 } }}>
      <CabeceraPaso
        indice={1}
        titulo="Elige el plan que te corresponde"
        texto="El sistema determina automáticamente qué planes te corresponden."
      />

      {!listo ? (
        <Stack spacing={2}>
          {[0, 1].map((i) => (
            <Skeleton key={i} variant="rounded" height={110} />
          ))}
        </Stack>
      ) : (
        <Stack spacing={2}>
          {planes.length > 1 && (
            <Alert severity="success" icon={<Iconify icon="solar:monitor-bold" />}>
              Tu destacamento tiene una licencia RRI TRaC activa: puedes pagar solo la cuota de
              registro.
            </Alert>
          )}
          {planes.map((p) => (
            <TarjetaPlan
              key={p.id}
              plan={p}
              seleccionable
              elegido={plan?.id === p.id}
              onElegir={() => elegirPlan(p.id)}
              etiqueta={
                planes.length === 1 && p.id === 'nuevo'
                  ? 'Única opción si no hubo registro 2026'
                  : undefined
              }
            />
          ))}
          <Alert severity="info">
            <strong>RRI TRaC</strong> es la plataforma digital de registro, control y capacitación
            de miembros.
            {elegibilidad?.registrado2026 === true &&
              ' Tu destacamento consta como registrado en 2026.'}
          </Alert>
        </Stack>
      )}

      <Stack direction="row" spacing={2} sx={{ mt: 4, justifyContent: 'space-between' }}>
        <Button
          size="large"
          variant="outlined"
          startIcon={<Iconify icon="eva:arrow-ios-back-fill" />}
          onClick={() => router.push(PASOS[0].ruta)}
        >
          Atrás
        </Button>
        <Button
          size="large"
          variant="contained"
          disabled={!listo || !plan}
          endIcon={<Iconify icon="eva:arrow-forward-fill" />}
          onClick={() => router.push(PASOS[2].ruta)}
        >
          Continuar al pago
        </Button>
      </Stack>
    </Card>
  );
}
