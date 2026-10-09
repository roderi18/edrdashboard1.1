'use client';

import { varAlpha } from 'minimal-shared/utils';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Radio from '@mui/material/Radio';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import CardActionArea from '@mui/material/CardActionArea';

import { formatearRd } from 'src/utils/planes-membresia.mjs';

import { Label } from 'src/components/label';
import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------
// Una tarifa: en la portada (solo se muestra) y en el paso "Plan" (se elige).
// El color distingue el segmento (sin registro, fidelidad, licencia), y es el
// mismo en las dos pantallas.
// ----------------------------------------------------------------------

export function TarjetaPlan({
  plan,
  seleccionable = false,
  elegido = false,
  onElegir,
  etiqueta,
  // Un plan que no le toca al destacamento: se ve apagado, con el porqué.
  motivoNoAplica,
}) {
  const contenido = (
    <Stack
      direction={seleccionable ? { xs: 'column', sm: 'row' } : 'column'}
      spacing={2}
      sx={{
        p: 2.5,
        alignItems: seleccionable ? { sm: 'center' } : 'flex-start',
        height: 1,
      }}
    >
      <Stack direction="row" spacing={2} sx={{ alignItems: 'center', flexGrow: 1 }}>
        {seleccionable && !motivoNoAplica && (
          <Radio checked={elegido} tabIndex={-1} sx={{ ml: -1 }} />
        )}
        <Box
          sx={(t) => ({
            width: 56,
            height: 56,
            flexShrink: 0,
            display: 'flex',
            borderRadius: '50%',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'common.white',
            bgcolor: t.vars.palette[plan.color].main,
          })}
        >
          <Iconify icon={plan.icono} width={28} />
        </Box>
        <Box>
          <Typography variant="subtitle1" sx={{ color: `${plan.color}.dark` }}>
            {plan.nombre}
          </Typography>
          <Typography variant="h3" component="p" sx={{ lineHeight: 1.2 }}>
            {formatearRd(plan.precio)}
          </Typography>
          <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', mt: 0.5 }}>
            <Iconify
              icon={plan.incluyeRriTrac ? 'eva:checkmark-fill' : 'eva:minus-circle-fill'}
              width={18}
              sx={{
                color: plan.incluyeRriTrac ? 'success.main' : 'text.disabled',
              }}
            />
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {plan.detalle}
            </Typography>
          </Stack>
        </Box>
      </Stack>
      {/* Un plan que no aplica solo se ve apagado: sin rótulo. */}
      {!motivoNoAplica && (
        <Label
          color={plan.color === 'primary' ? 'info' : plan.color}
          sx={{
            height: 'auto',
            py: 0.75,
            whiteSpace: 'normal',
            alignSelf: seleccionable ? 'center' : 'stretch',
          }}
        >
          {etiqueta ?? plan.etiqueta}
        </Label>
      )}
    </Stack>
  );

  if (motivoNoAplica) {
    return (
      <Card variant="outlined" sx={{ height: 1, borderStyle: 'dashed', bgcolor: 'transparent' }}>
        <Box sx={{ opacity: 0.55 }}>{contenido}</Box>
        <Typography
          variant="caption"
          sx={{ display: 'block', px: 2.5, pb: 2, color: 'text.secondary' }}
        >
          {motivoNoAplica}
        </Typography>
      </Card>
    );
  }

  return (
    <Card
      variant="outlined"
      sx={(t) => ({
        height: 1,
        borderWidth: 1.5,
        borderColor: elegido
          ? t.vars.palette[plan.color].main
          : varAlpha(t.vars.palette[plan.color].mainChannel, 0.32),
        bgcolor: elegido
          ? varAlpha(t.vars.palette[plan.color].mainChannel, 0.06)
          : 'background.paper',
        transition: t.transitions.create(['border-color', 'background-color']),
      })}
    >
      {seleccionable ? (
        <CardActionArea onClick={onElegir} aria-pressed={elegido} sx={{ height: 1 }}>
          {contenido}
        </CardActionArea>
      ) : (
        contenido
      )}
    </Card>
  );
}
