'use client';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';

import { OPCIONES_ESTATUS_MIEMBRO } from 'src/utils/estatus-miembro.mjs';

import { Label } from 'src/components/label';
import { Iconify } from 'src/components/iconify';

import { CATEGORIAS } from './estadisticas-demograficas.mjs';
import { caja, numero, titulo, fondoSuave } from './datos-demograficos-estilos';

export function Metrica({ icono, cantidad, etiqueta, detalle, color = 'primary' }) {
  return (
    <Box sx={{ ...caja, p: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
      <Box
        sx={{
          width: 48,
          height: 48,
          flexShrink: 0,
          borderRadius: 1.5,
          display: 'grid',
          placeItems: 'center',
          color: `${color}.main`,
          bgcolor: fondoSuave(color),
        }}
      >
        <Iconify icon={icono} width={26} />
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="h4" sx={{ lineHeight: 1.1 }}>
          {cantidad}
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {etiqueta}
        </Typography>
        {detalle && (
          <Typography variant="caption" sx={{ color: 'text.disabled' }}>
            {detalle}
          </Typography>
        )}
      </Box>
    </Box>
  );
}

export function Categoria({ item, cantidad, total, activa, onClick }) {
  return (
    <Box
      component="button"
      type="button"
      onClick={onClick}
      aria-pressed={activa}
      sx={{
        ...caja,
        minWidth: 0,
        p: 1.5,
        textAlign: 'left',
        display: 'flex',
        gap: 1.5,
        alignItems: 'center',
        cursor: 'pointer',
        font: 'inherit',
        color: 'text.primary',
        borderColor: activa ? `${item.color}.main` : 'divider',
        bgcolor: activa ? fondoSuave(item.color) : 'background.paper',
        transition: (theme) => theme.transitions.create(['border-color', 'background-color']),
        '&:hover': { borderColor: `${item.color}.main` },
      }}
    >
      {/* La insignia sola, sin círculo de color detrás: el color ya va en el nombre. */}
      <Box
        component="img"
        src={item.imagen}
        alt=""
        sx={{ width: 56, height: 56, flexShrink: 0, objectFit: 'contain' }}
      />

      <Box sx={{ minWidth: 0 }}>
        <Typography
          variant="overline"
          noWrap
          sx={{ display: 'block', color: `${item.color}.main` }}
        >
          {item.nombre}
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {item.edades}
        </Typography>
        <Typography variant="h5" sx={{ lineHeight: 1.2 }}>
          {numero(cantidad)}
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          <Box component="span" sx={{ color: `${item.color}.main`, fontWeight: 'fontWeightBold' }}>
            {total ? Math.round((cantidad * 100) / total) : 0}%
          </Box>{' '}
          del total
        </Typography>
      </Box>
    </Box>
  );
}

export function PanelProvincia({ nombre, resumen, region, imagenRegion, onCerrar }) {
  return (
    <Box sx={{ ...caja, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <Stack
        direction="row"
        sx={{
          bgcolor: 'brand.navy',
          color: 'common.white',
          pl: 2,
          pr: 1,
          py: 1,
          gap: 1,
          alignItems: 'center',
        }}
      >
        <Iconify icon="solar:map-point-linear" width={22} />
        <Typography variant="h6" noWrap sx={{ flex: 1 }}>
          {nombre}
        </Typography>
        <Label color={region?.color || 'default'} variant="filled">
          {region?.nombre || 'Sin región'}
        </Label>
        <IconButton
          size="small"
          onClick={onCerrar}
          aria-label="Cerrar detalle provincial"
          sx={{ color: 'inherit' }}
        >
          <Iconify icon="mingcute:close-line" width={18} />
        </IconButton>
      </Stack>
      <Box sx={{ p: 2 }}>
        <Stack direction="row" sx={{ gap: 2, alignItems: 'center', mb: 2 }}>
          {imagenRegion ? (
            <Box
              component="img"
              src={imagenRegion}
              alt={region?.nombre || 'Región'}
              sx={{ width: 72, height: 72, objectFit: 'cover', borderRadius: '50%' }}
            />
          ) : (
            <Box
              sx={{
                width: 72,
                height: 72,
                flexShrink: 0,
                color: `${region?.color || 'primary'}.main`,
                bgcolor: fondoSuave(region?.color || 'primary'),
                borderRadius: '50%',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <Iconify icon="solar:map-point-linear" width={32} />
            </Box>
          )}
          <Box sx={{ display: 'grid', flex: 1, gridTemplateColumns: '1fr 1fr', gap: 1 }}>
            {[
              [resumen.dests.length, 'Destacamentos'],
              [resumen.miembros.length, 'Miembros'],
              [resumen.iglesias, 'Iglesias'],
              [resumen.pendientes, 'Fichas pendientes'],
            ].map(([valor, texto]) => (
              <Box key={texto}>
                <Typography variant="h6" sx={{ lineHeight: 1.2 }}>
                  {numero(valor)}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {texto}
                </Typography>
              </Box>
            ))}
          </Box>
        </Stack>
        <Typography sx={{ ...titulo, mb: 1 }}>Distribución por edad y categoría</Typography>
        {CATEGORIAS.map((item) => {
          const cantidad = resumen.porCategoria[item.id];
          const porcentaje = resumen.miembros.length
            ? Math.round((cantidad * 100) / resumen.miembros.length)
            : 0;
          return (
            <Box
              key={item.id}
              sx={{
                py: 0.75,
                borderBottom: (theme) => `1px dashed ${theme.vars.palette.divider}`,
                display: 'grid',
                gridTemplateColumns: 'minmax(105px, 1fr) minmax(60px, 1fr) 40px 44px',
                gap: 1,
                alignItems: 'center',
                typography: 'caption',
              }}
            >
              <Typography
                variant="caption"
                noWrap
                sx={{ borderLeft: 4, borderColor: `${item.color}.main`, pl: 0.75 }}
              >
                {item.nombre}
              </Typography>
              <Box sx={{ height: 8, bgcolor: fondoSuave(item.color, 0.16), borderRadius: 1 }}>
                <Box
                  sx={{
                    width: `${porcentaje}%`,
                    height: 1,
                    borderRadius: 1,
                    bgcolor: `${item.color}.main`,
                  }}
                />
              </Box>
              <Box sx={{ textAlign: 'right', color: 'text.secondary' }}>{porcentaje}%</Box>
              <Box sx={{ textAlign: 'right', fontWeight: 'fontWeightSemiBold' }}>
                {numero(cantidad)}
              </Box>
            </Box>
          );
        })}
        <Typography variant="caption" component="p" sx={{ mt: 1.5, color: 'text.disabled' }}>
          Selecciona una provincia en el mapa para consultar sus cifras.
        </Typography>
        <EstatusDeMiembros resumen={resumen} />
      </Box>
    </Box>
  );
}

// "Fallecido" lleva el color 'default' del Label, que no es una clave de la paleta.
const tonoDe = (color) => (color === 'default' ? 'grey.500' : `${color}.main`);

/** Los cuatro estatus (los mueve la asistencia): barra apilada y cifra de cada uno. */
function EstatusDeMiembros({ resumen }) {
  const total = resumen.miembros.length;
  const porcentaje = (valor) => (total ? Math.round((valor * 100) / total) : 0);
  return (
    <Box sx={{ mt: 2, pt: 2, borderTop: (theme) => `1px dashed ${theme.vars.palette.divider}` }}>
      <Typography sx={{ ...titulo, mb: 1 }}>Estatus del miembro</Typography>
      <Stack
        direction="row"
        sx={{ height: 8, borderRadius: 1, overflow: 'hidden', bgcolor: 'action.hover', mb: 1.5 }}
      >
        {OPCIONES_ESTATUS_MIEMBRO.map((o) => (
          <Box
            key={o.value}
            sx={{
              width: `${(resumen.porEstatus[o.value] * 100) / (total || 1)}%`,
              bgcolor: tonoDe(o.color),
            }}
          />
        ))}
      </Stack>
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
        {OPCIONES_ESTATUS_MIEMBRO.map((o) => (
          <Tooltip key={o.value} title={o.descripcion} arrow enterTouchDelay={0}>
            <Stack
              direction="row"
              sx={{ gap: 1, alignItems: 'center', typography: 'caption', cursor: 'default' }}
            >
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  flexShrink: 0,
                  bgcolor: tonoDe(o.color),
                }}
              />
              <Box
                sx={{
                  flex: 1,
                  minWidth: 0,
                  color: 'text.secondary',
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis',
                }}
              >
                {o.etiqueta}
              </Box>
              <Box sx={{ fontWeight: 'fontWeightSemiBold' }}>
                {numero(resumen.porEstatus[o.value])}
              </Box>
              <Box sx={{ minWidth: 32, textAlign: 'right', color: 'text.disabled' }}>
                {porcentaje(resumen.porEstatus[o.value])}%
              </Box>
            </Stack>
          </Tooltip>
        ))}
      </Box>
    </Box>
  );
}
