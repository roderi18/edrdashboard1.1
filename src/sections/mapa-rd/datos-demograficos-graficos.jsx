'use client';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import { useTheme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';

import { CATEGORIAS } from './estadisticas-demograficas.mjs';
import { caja, numero, titulo, fondoSuave } from './datos-demograficos-estilos';

// Masculino y femenino con los dos colores de la casa que no significan estado
// (azul y morado); "Sin dato" en gris.
const SEXOS = [
  ['Masculino', 'masculino', 'primary.main'],
  ['Femenino', 'femenino', 'secondary.main'],
  ['Sin dato', 'sinSexo', 'grey.400'],
];

const color = (theme, ruta) => ruta.split('.').reduce((a, k) => a[k], theme.vars.palette);

export function Genero({ resumen }) {
  const theme = useTheme();
  const total = resumen.miembros.length;
  const m = total ? (resumen.masculino * 100) / total : 0;
  const f = total ? (resumen.femenino * 100) / total : 0;
  return (
    <Box sx={{ ...caja, p: 2 }}>
      <Typography sx={titulo}>Distribución por género</Typography>
      <Stack direction="row" sx={{ gap: 2, alignItems: 'center', mt: 1.5 }}>
        <Box
          sx={{
            width: 96,
            height: 96,
            flexShrink: 0,
            borderRadius: '50%',
            background: `conic-gradient(${color(theme, SEXOS[0][2])} 0 ${m}%, ${color(theme, SEXOS[1][2])} ${m}% ${m + f}%, ${color(theme, SEXOS[2][2])} ${m + f}% 100%)`,
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <Box
            sx={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              bgcolor: 'background.paper',
              display: 'grid',
              placeItems: 'center',
              typography: 'subtitle1',
            }}
          >
            {numero(total)}
          </Box>
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {SEXOS.map(([texto, campo, tono]) => (
            <Stack
              key={texto}
              direction="row"
              sx={{ typography: 'caption', py: 0.5, gap: 1, alignItems: 'center' }}
            >
              <Box
                sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: tono, flexShrink: 0 }}
              />
              <Box sx={{ flex: 1, color: 'text.secondary' }}>{texto}</Box>
              <Box sx={{ fontWeight: 'fontWeightSemiBold' }}>
                {total ? Math.round((resumen[campo] * 100) / total) : 0}%
              </Box>
              <Box sx={{ minWidth: 32, textAlign: 'right' }}>{numero(resumen[campo])}</Box>
            </Stack>
          ))}
        </Box>
      </Stack>
    </Box>
  );
}

export function Edades({ resumen }) {
  const maximo = Math.max(1, ...Object.values(resumen.porCategoria));
  return (
    <Box sx={{ ...caja, p: 2 }}>
      <Typography sx={titulo}>Distribución por edad</Typography>
      <Stack direction="row" sx={{ height: 112, alignItems: 'flex-end', gap: 1, mt: 1 }}>
        {CATEGORIAS.map((item) => (
          <Box
            key={item.id}
            sx={{
              flex: 1,
              height: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-end',
              textAlign: 'center',
            }}
          >
            <Typography variant="caption" sx={{ fontWeight: 'fontWeightSemiBold' }}>
              {resumen.miembros.length
                ? Math.round((resumen.porCategoria[item.id] * 100) / resumen.miembros.length)
                : 0}
              %
            </Typography>
            <Box
              sx={{
                bgcolor: `${item.color}.main`,
                borderRadius: '6px 6px 0 0',
                height: `${Math.max(4, (resumen.porCategoria[item.id] * 60) / maximo)}%`,
              }}
            />
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {item.edades.split(' ')[0]}
            </Typography>
          </Box>
        ))}
      </Stack>
    </Box>
  );
}

export function Regiones({ resumen, onElegir }) {
  return (
    <Box sx={{ ...caja, p: 2, overflowX: 'auto' }}>
      <Typography sx={titulo}>Destacamentos por región</Typography>
      <Box
        component="table"
        sx={{
          width: 1,
          borderCollapse: 'collapse',
          mt: 1,
          '& td, & th': {
            typography: 'caption',
            textAlign: 'left',
            py: 0.75,
            borderBottom: (theme) => `1px dashed ${theme.vars.palette.divider}`,
          },
          '& th': { color: 'text.secondary', fontWeight: 'fontWeightSemiBold' },
          '& tbody tr:hover': { bgcolor: 'action.hover' },
        }}
      >
        <thead>
          <tr>
            <th>Región</th>
            <th>Dest.</th>
            <th>Miembros</th>
            <th>Iglesias</th>
          </tr>
        </thead>
        <tbody>
          {resumen.porRegion.map((r) => (
            <tr key={r.nombre} onClick={() => onElegir(r.nombre)} style={{ cursor: 'pointer' }}>
              <td>
                <Box
                  component="span"
                  sx={{
                    display: 'inline-block',
                    width: 8,
                    height: 8,
                    mr: 0.75,
                    borderRadius: '50%',
                    bgcolor: `${r.color}.main`,
                  }}
                />
                {r.nombre.replace('Región ', '')}
              </td>
              <td>{numero(r.destacamentos)}</td>
              <td>{numero(r.miembros)}</td>
              <td>{numero(r.iglesias)}</td>
            </tr>
          ))}
        </tbody>
      </Box>
    </Box>
  );
}

export function Serie({ resumen, periodo, onPeriodo }) {
  const theme = useTheme();
  const registros = resumen.serieMensual.reduce((total, valor) => total + valor, 0);
  const maximo = Math.max(1, ...resumen.serieMensual);
  const puntos = resumen.serieMensual
    .map((v, i) => `${12 + 25 * i},${76 - (58 * v) / maximo}`)
    .join(' ');
  const linea = theme.vars.palette.primary.main;
  return (
    <Box sx={{ ...caja, p: 2 }}>
      <Stack direction="row" sx={{ alignItems: 'center', gap: 1 }}>
        <Typography sx={{ ...titulo, flex: 1 }}>Registros por mes · {periodo}</Typography>
        {[new Date().getFullYear(), new Date().getFullYear() - 1].map((ano) => (
          <Button
            key={ano}
            size="small"
            color="primary"
            variant={periodo === String(ano) ? 'soft' : 'text'}
            onClick={() => onPeriodo(String(ano))}
            sx={{ minWidth: 0, px: 1 }}
          >
            {ano}
          </Button>
        ))}
      </Stack>
      {registros ? (
        <Box
          component="svg"
          viewBox="0 0 300 90"
          role="img"
          aria-label={`Registros mensuales de ${periodo}`}
          sx={{ width: 1, height: 84, mt: 1 }}
        >
          {[18, 47, 76].map((y) => (
            <line key={y} x1="12" x2="287" y1={y} y2={y} stroke={theme.vars.palette.divider} />
          ))}
          <polyline points={puntos} fill="none" stroke={linea} strokeWidth="2.5" />
          {resumen.serieMensual.map((v, i) => (
            <circle key={i} cx={12 + 25 * i} cy={76 - (58 * v) / maximo} r="2.5" fill={linea} />
          ))}
          <text x="12" y="88" fontSize="9" fill={theme.vars.palette.text.secondary}>
            Ene
          </text>
          <text x="262" y="88" fontSize="9" fill={theme.vars.palette.text.secondary}>
            Dic
          </text>
        </Box>
      ) : (
        <Box
          sx={{
            height: 84,
            mt: 1,
            display: 'grid',
            placeItems: 'center',
            color: 'text.disabled',
            typography: 'body2',
            borderRadius: 1,
            bgcolor: fondoSuave('primary', 0.04),
          }}
        >
          Sin fechas de alta en {periodo}
        </Box>
      )}
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        {numero(registros)} miembros con fecha de registro en {periodo}
      </Typography>
    </Box>
  );
}
