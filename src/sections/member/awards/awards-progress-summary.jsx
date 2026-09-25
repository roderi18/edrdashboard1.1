'use client';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';
import CircularProgress from '@mui/material/CircularProgress';

import { fNumber } from 'src/utils/format-number';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------
// RESUMEN DEL PROGRESO, encima de la tabla de programas en la raíz de la
// pestaña Sistema de Ascenso. Las cifras las calcula `resumirProgresoDeAscenso`
// (`src/utils/progreso-de-ascenso.mjs`) con la misma cuenta que las filas, para
// que la tarjeta y la tabla nunca digan dos cosas distintas.
// ----------------------------------------------------------------------

function Dato({ icono, titulo, valor, detalle, children }) {
  return (
    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0, flex: 1 }}>
      {children ?? (
        <Iconify icon={icono} width={26} sx={{ color: 'primary.main', flexShrink: 0 }} />
      )}
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
          {titulo}
        </Typography>
        <Typography variant="subtitle1" noWrap>
          {valor}
        </Typography>
        {detalle && (
          <Typography variant="caption" sx={{ color: 'text.disabled', display: 'block' }} noWrap>
            {detalle}
          </Typography>
        )}
      </Box>
    </Stack>
  );
}

export function AwardsProgressSummary({ resumen, onAbrirPrograma }) {
  const theme = useTheme();
  const { siguiente } = resumen;

  const renderAnillo = () => (
    <Box sx={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
      <CircularProgress
        variant="determinate"
        value={100}
        size={48}
        thickness={4}
        sx={{ color: alpha(theme.palette.grey[500], 0.16), position: 'absolute' }}
      />
      <CircularProgress variant="determinate" value={resumen.porcentaje} size={48} thickness={4} />
      <Box
        sx={{
          inset: 0,
          display: 'flex',
          position: 'absolute',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Typography variant="subtitle2">{resumen.porcentaje}%</Typography>
      </Box>
    </Box>
  );

  const renderProgreso = () => (
    <Card sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ px: 2.5, pt: 2, pb: 1.5 }}>
        <Avatar sx={{ width: 36, height: 36, bgcolor: 'primary.main' }}>
          <Iconify icon="solar:medal-ribbon-star-bold" width={20} />
        </Avatar>
        <Box>
          <Typography variant="h6">Progreso de ascenso</Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Resumen del avance en los programas de formación.
          </Typography>
        </Box>
      </Stack>

      {/* Crece hasta el alto de "Próximo paso" y centra los datos en él. */}
      <Box
        sx={{
          px: 2.5,
          flexGrow: 1,
          display: 'flex',
          alignItems: 'center',
          bgcolor: alpha(theme.palette.grey[500], 0.04),
        }}
      >
        <Box
          sx={{
            py: 2,
            gap: 2,
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, auto)' },
            justifyContent: 'start',
            // Separador vertical solo cuando van en una fila.
            '& > *:not(:first-of-type)': {
              pl: { sm: 3 },
              borderLeft: { sm: `1px dashed ${theme.vars.palette.divider}` },
            },
          }}
        >
          <Dato
            titulo="Progreso general"
            valor={`${fNumber(resumen.completados)} / ${fNumber(resumen.total)}`}
            detalle="adiestramientos completados"
          >
            {renderAnillo()}
          </Dato>
          <Dato
            icono="solar:medal-star-bold"
            titulo="Nivel actual"
            valor={siguiente?.dirigidoA || 'Todos los programas'}
            detalle={siguiente ? 'En formación' : 'Completados'}
          />
        </Box>
      </Box>
    </Card>
  );

  const renderProximoPaso = () => (
    <Card
      sx={{
        px: 2.5,
        py: 2,
        flex: 1,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1.5 }}>
        <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main' }}>
          <Iconify icon="eva:arrow-forward-fill" width={18} />
        </Avatar>
        <Typography variant="subtitle1">Próximo paso</Typography>
      </Stack>

      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5, flexGrow: 1 }}>
        {siguiente ? (
          <>
            Completa {fNumber(siguiente.pendientes)}{' '}
            {siguiente.pendientes === 1 ? 'adiestramiento' : 'adiestramientos'} del programa{' '}
            <strong>{siguiente.nombre}</strong> para avanzar al siguiente nivel.
          </>
        ) : (
          'Todos los programas de formación están completados.'
        )}
      </Typography>

      {siguiente && (
        <Button
          fullWidth
          variant="contained"
          color="primary"
          startIcon={<Iconify icon="solar:notebook-bold-duotone" />}
          onClick={() => onAbrirPrograma(siguiente.id)}
        >
          Ver programa
        </Button>
      )}
    </Card>
  );

  return (
    // Mitad y mitad: sin la barra, la de progreso ya no necesita más ancho.
    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2.5}>
      {renderProgreso()}
      {renderProximoPaso()}
    </Stack>
  );
}
