'use client';

import { varAlpha } from 'minimal-shared/utils';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { fDopCurrency } from 'src/utils/format-number';
import {
  sanearCombo,
  maximoDeCombo,
  tiempoRestante,
  cantidadDeExtra,
} from 'src/utils/combos-de-actividad.mjs';

import { azulLegible } from 'src/theme/azul-legible';

import { Label } from 'src/components/label';
import { Iconify } from 'src/components/iconify';
import { NumberInput } from 'src/components/number-input';

import { iconoDeExtra, COLOR_POR_PUESTO } from './combo-de-actividad';

// ----------------------------------------------------------------------
// UN COMBO DENTRO DE "INSCRIBIRME", ESTILO 2.
//
// El mismo combo que el estilo 1 (`combo-de-actividad.jsx`), mismos datos y
// mismas cuentas, ordenado de otra forma: arriba foto, etiqueta, precio "por
// persona", el cierre en una sola línea y la cantidad; en medio "Incluye" en
// lista y los extras en filas compactas con su cuenta a la vista; abajo el
// subtotal de ese combo. Se elige en el desplegable del diálogo.
// ----------------------------------------------------------------------

const dos = (valor) => String(valor).padStart(2, '0');

// "parche de edición especial" → "Parche de edición especial": al quitar el
// "Agregar" del título el texto quedaba empezando en minúscula.
const mayusculaInicial = (texto) =>
  texto ? `${texto.charAt(0).toUpperCase()}${texto.slice(1)}` : texto;

/** "4 d 05 h 02 min", o "05 h 02 min" el último día. */
const textoDelCierre = (restante) =>
  restante.dias > 0
    ? `${restante.dias} d ${dos(restante.horas)} h ${dos(restante.minutos)} min`
    : `${dos(restante.horas)} h ${dos(restante.minutos)} min`;

function FilaDeExtra({ extra, producto, cantidad, conCombo, onCambiar }) {
  const maximo = maximoDeCombo(producto);
  const agotado = maximo === 0;
  const precio = Number(producto.price) || 0;

  return (
    <Box
      sx={(theme) => ({
        px: 1.25,
        py: 1,
        gap: 1.25,
        display: 'flex',
        alignItems: 'center',
        borderRadius: 1.5,
        bgcolor: varAlpha(theme.vars.palette.primary.mainChannel, 0.08),
      })}
    >
      <Iconify
        icon={iconoDeExtra(producto)}
        width={22}
        sx={(theme) => ({ ...azulLegible(theme), flexShrink: 0 })}
      />

      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Typography variant="subtitle2" noWrap sx={(theme) => azulLegible(theme)}>
          {mayusculaInicial(extra.titulo?.replace(/^Agregar\s+/i, '')) || producto.name}
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
          {agotado
            ? 'Agotado'
            : !conCombo
              ? `${fDopCurrency(precio)} c/u · elige el combo primero`
              : `${fDopCurrency(precio)} c/u${
                  cantidad > 0 ? ` · ${cantidad} = ${fDopCurrency(precio * cantidad)}` : ''
                }`}
        </Typography>
      </Box>

      <NumberInput
        hideDivider
        min={0}
        max={maximo}
        value={conCombo ? cantidad : 0}
        disabled={agotado || !conCombo}
        onChange={(event, valor) => onCambiar(valor)}
        sx={{ width: 104, flexShrink: 0, bgcolor: 'background.paper', borderRadius: 1 }}
      />
    </Box>
  );
}

export function ComboDeActividadEstilo2({
  combo,
  puesto,
  ahora,
  cantidad,
  onCantidad,
  extras,
  cantidadesExtras,
  onExtra,
}) {
  const datos = sanearCombo(combo.combo) ?? {};
  const maximo = maximoDeCombo(combo);
  const restante = tiempoRestante(datos.finVenta, ahora);
  const cerrado = Boolean(restante?.cerrado);
  const sePuedePedir = maximo > 0 && !cerrado;
  const conCombo = cantidad > 0;

  // El subtotal de este combo: él y sus extras (las mismas cuentas que el total).
  const piezasExtra = extras.map(({ producto }) =>
    cantidadDeExtra({
      cantidadCombo: cantidad,
      pedidos: cantidadesExtras[`${combo.id}:${producto.id}`],
      extra: producto,
    })
  );
  const totalExtras = piezasExtra.reduce((suma, valor) => suma + valor, 0);
  const subtotal =
    (Number(combo.price) || 0) * cantidad +
    extras.reduce(
      (suma, { producto }, indice) => suma + (Number(producto.price) || 0) * piezasExtra[indice],
      0
    );

  return (
    <Box
      sx={(theme) => ({
        overflow: 'hidden',
        borderRadius: 2,
        opacity: sePuedePedir ? 1 : 0.64,
        // El combo 1 resalta con el azul de la casa; los demás, borde fino.
        border:
          puesto === 0
            ? `solid 2px ${theme.vars.palette.primary.main}`
            : `solid 1px ${theme.vars.palette.divider}`,
      })}
    >
      {/* ENCABEZADO: foto, etiqueta, precio, cierre y cantidad. */}
      <Stack
        direction="row"
        spacing={2}
        sx={{
          p: { xs: 1.5, sm: 2 },
          alignItems: 'center',
          borderBottom: (theme) => `solid 1px ${theme.vars.palette.divider}`,
        }}
      >
        <Box sx={{ position: 'relative', flexShrink: 0 }}>
          {combo.coverUrl ? (
            <Box
              component="img"
              alt={combo.name}
              src={combo.coverUrl}
              sx={{
                width: 72,
                height: 72,
                display: 'block',
                borderRadius: 1.5,
                objectFit: 'cover',
              }}
            />
          ) : (
            <Box
              sx={{
                width: 72,
                height: 72,
                display: 'grid',
                placeItems: 'center',
                borderRadius: 1.5,
                color: 'text.disabled',
                bgcolor: 'background.neutral',
              }}
            >
              <Iconify icon="solar:gallery-wide-bold" width={26} />
            </Box>
          )}
          {datos.destacado && (
            <Box
              sx={{
                top: -6,
                right: -6,
                width: 24,
                height: 24,
                display: 'grid',
                borderRadius: '50%',
                placeItems: 'center',
                position: 'absolute',
                bgcolor: 'warning.main',
                color: 'warning.contrastText',
              }}
            >
              <Iconify icon="solar:medal-star-bold" width={14} />
            </Box>
          )}
        </Box>

        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          {datos.etiqueta ? (
            <Label variant="soft" color={COLOR_POR_PUESTO[puesto] ?? 'default'}>
              {datos.etiqueta}
              {datos.destacado ? ' · Más elegido' : ''}
            </Label>
          ) : (
            <Typography variant="subtitle1">{combo.name}</Typography>
          )}

          <Stack direction="row" spacing={1} sx={{ mt: 0.75, alignItems: 'baseline' }}>
            <Typography variant="h5">{fDopCurrency(combo.price)}</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              por persona
            </Typography>
          </Stack>

          {restante && (
            <Stack
              direction="row"
              spacing={0.5}
              sx={{
                mt: 0.25,
                alignItems: 'center',
                color: cerrado ? 'text.disabled' : 'warning.dark',
              }}
            >
              <Iconify icon="solar:clock-circle-outline" width={16} />
              <Typography variant="caption" sx={{ color: 'inherit', fontWeight: 600 }}>
                {cerrado ? 'Venta cerrada' : `Cierra en ${textoDelCierre(restante)}`}
              </Typography>
            </Stack>
          )}
        </Box>

        <Box sx={{ flexShrink: 0, textAlign: 'center' }}>
          {sePuedePedir ? (
            <>
              <NumberInput
                hideDivider
                min={0}
                max={maximo}
                value={cantidad}
                onChange={(event, valor) => onCantidad(valor)}
                sx={{ width: 120 }}
              />
              <Typography
                variant="caption"
                sx={{ color: 'text.disabled', display: 'block', mt: 0.5 }}
              >
                {maximo} disponibles
              </Typography>
            </>
          ) : (
            <Label color="default">{cerrado ? 'Cerrado' : 'Agotado'}</Label>
          )}
        </Box>
      </Stack>

      {/* CUERPO: "Incluye" en lista y los extras con su cuenta. */}
      {(!!datos.incluye?.length || !!extras.length) && (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              md:
                extras.length && datos.incluye?.length ? 'minmax(0, 1fr) minmax(0, 1.2fr)' : '1fr',
            },
          }}
        >
          {!!datos.incluye?.length && (
            <Box
              sx={{
                px: 2,
                py: 1.5,
                borderRight: {
                  md: extras.length ? (theme) => `solid 1px ${theme.vars.palette.divider}` : 'none',
                },
              }}
            >
              <Typography
                variant="caption"
                sx={{ color: 'text.secondary', display: 'block', mb: 1 }}
              >
                Incluye
              </Typography>
              <Stack spacing={0.75}>
                {datos.incluye.map((item) => (
                  <Stack
                    key={item.texto}
                    direction="row"
                    spacing={0.75}
                    sx={{ alignItems: 'center' }}
                  >
                    <Iconify icon="eva:checkmark-fill" width={16} sx={{ color: 'success.main' }} />
                    <Typography variant="body2">{item.texto}</Typography>
                  </Stack>
                ))}
              </Stack>
            </Box>
          )}

          {!!extras.length && (
            <Box sx={{ px: 2, py: 1.5 }}>
              <Typography
                variant="caption"
                sx={{ color: 'text.secondary', display: 'block', mb: 1 }}
              >
                Agrega a tu combo (opcional)
              </Typography>
              <Stack spacing={1}>
                {extras.map(({ producto, ...extra }) => (
                  <FilaDeExtra
                    key={producto.id}
                    extra={extra}
                    producto={producto}
                    cantidad={cantidadesExtras[`${combo.id}:${producto.id}`] ?? 0}
                    conCombo={conCombo}
                    onCambiar={(valor) => onExtra(producto.id, valor)}
                  />
                ))}
              </Stack>
            </Box>
          )}
        </Box>
      )}

      {/* PIE: lo que suma este combo antes del total general. */}
      {conCombo && (
        <Stack
          direction="row"
          sx={{
            px: 2,
            py: 1,
            alignItems: 'center',
            justifyContent: 'space-between',
            bgcolor: 'background.neutral',
            borderTop: (theme) => `solid 1px ${theme.vars.palette.divider}`,
          }}
        >
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {cantidad} {cantidad === 1 ? 'combo' : 'combos'}
            {totalExtras > 0 ? ` + ${totalExtras} ${totalExtras === 1 ? 'extra' : 'extras'}` : ''}
          </Typography>
          <Typography variant="body2">
            Subtotal de este combo{' '}
            <Box component="span" sx={{ typography: 'subtitle1', ml: 0.5 }}>
              {fDopCurrency(subtotal)}
            </Box>
          </Typography>
        </Stack>
      )}
    </Box>
  );
}
