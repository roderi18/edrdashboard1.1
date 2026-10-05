'use client';

import { varAlpha } from 'minimal-shared/utils';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { fDopCurrency } from 'src/utils/format-number';
import { sanearCombo, maximoDeCombo, tiempoRestante } from 'src/utils/combos-de-actividad.mjs';

import { azulLegible } from 'src/theme/azul-legible';

import { Label } from 'src/components/label';
import { Iconify } from 'src/components/iconify';
import { NumberInput } from 'src/components/number-input';

// ----------------------------------------------------------------------
// UN COMBO DENTRO DE "INSCRIBIRME".
//
// Foto, etiqueta, nombre y precio; el conteo regresivo hasta que cierra su
// venta; cuántos llevar; lo que incluye, y los extras opcionales (otros
// productos de la tienda, uno por combo). Los datos salen del campo `combo` del
// producto (regla en `src/utils/combos-de-actividad.mjs`): un combo sin ellos se
// pinta solo con foto, nombre, precio y cantidad.
//
// En el teléfono las piezas se apilan; en pantalla ancha, foto | datos |
// conteo | cantidad, y debajo lo que incluye y los extras.
// ----------------------------------------------------------------------

// El icono de cada cosa que incluye un combo (ver `TIPOS_DE_INCLUYE`). Todos del
// paquete registrado: uno sin registrar se carga de internet y parpadea.
export const ICONO_DE_INCLUYE = {
  camiseta: 'custom:categoria-camisetas',
  parche: 'custom:categoria-parches',
  gorra: 'custom:categoria-accesorios',
  inscripcion: 'solar:file-text-bold',
  pin: 'custom:categoria-pines',
  otro: 'solar:box-minimalistic-bold',
};

export const iconoDeExtra = (producto = {}) =>
  producto.category === 'pines' ? ICONO_DE_INCLUYE.pin : ICONO_DE_INCLUYE.parche;

// Las etiquetas se distinguen por el puesto del combo: el 1 con el azul de la
// casa, el 2 y el 3 con los otros colores de la paleta.
export const COLOR_POR_PUESTO = ['primary', 'secondary', 'warning'];

const FOTO = { width: { xs: 76, md: 104 }, height: { xs: 76, md: 104 }, borderRadius: 2 };

const dos = (valor) => String(valor).padStart(2, '0');

function ConteoRegresivo({ restante }) {
  const casillas = [
    [restante.dias, 'Días'],
    [restante.horas, 'Horas'],
    [restante.minutos, 'Minutos'],
    [restante.segundos, 'Segundos'],
  ];

  return (
    <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'background.neutral' }}>
      <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', mb: 1 }}>
        <Iconify icon="solar:clock-circle-bold" width={18} />
        <Typography variant="caption" sx={{ fontWeight: 600 }}>
          Termina en:
        </Typography>
      </Stack>

      <Stack direction="row" spacing={1}>
        {casillas.map(([valor, nombre]) => (
          <Box key={nombre} sx={{ textAlign: 'center', minWidth: 48 }}>
            {/* El color de texto sobre el de fondo: se invierte solo en oscuro. */}
            <Box
              sx={{
                py: 0.75,
                borderRadius: 1.25,
                typography: 'h6',
                bgcolor: 'text.primary',
                color: 'background.paper',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {dos(valor)}
            </Box>
            <Typography
              variant="caption"
              sx={{ color: 'text.secondary', mt: 0.5, display: 'block' }}
            >
              {nombre}
            </Typography>
          </Box>
        ))}
      </Stack>
    </Box>
  );
}

function ExtraDelCombo({ extra, producto, cantidad, conCombo, onCambiar }) {
  const maximo = maximoDeCombo(producto);
  const agotado = maximo === 0;

  return (
    <Box
      sx={(theme) => ({
        p: 1.5,
        gap: 1.5,
        display: 'flex',
        alignItems: 'center',
        borderRadius: 2,
        border: `solid 1px ${varAlpha(theme.vars.palette.primary.mainChannel, 0.24)}`,
        bgcolor: varAlpha(theme.vars.palette.primary.mainChannel, 0.08),
      })}
    >
      <Iconify
        icon={iconoDeExtra(producto)}
        width={28}
        sx={(theme) => ({ ...azulLegible(theme), flexShrink: 0 })}
      />

      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Typography variant="subtitle2" sx={(theme) => azulLegible(theme)}>
          {extra.titulo || `Agregar ${producto.name}`}{' '}
          <Box component="span" sx={{ typography: 'caption', color: 'text.secondary' }}>
            (opcional)
          </Box>
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {producto.name}
        </Typography>
        <Typography variant="subtitle2">
          {agotado ? 'Agotado' : `${fDopCurrency(producto.price)} c/u`}
        </Typography>
      </Box>

      {/* Contador y no interruptor: se pueden llevar varios, y cada uno suma
          su precio. Apagado mientras no se elija el combo: es un extra suyo. */}
      <Box sx={{ flexShrink: 0, textAlign: 'center' }}>
        <NumberInput
          hideDivider
          min={0}
          max={maximo}
          value={conCombo ? cantidad : 0}
          disabled={agotado || !conCombo}
          onChange={(event, valor) => onCambiar(valor)}
          sx={{ width: 120 }}
        />
        {!conCombo && !agotado && (
          <Typography variant="caption" sx={{ color: 'text.disabled', display: 'block', mt: 0.5 }}>
            Elige el combo primero
          </Typography>
        )}
      </Box>
    </Box>
  );
}

export function ComboDeActividad({
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

  return (
    <Box
      sx={{
        p: { xs: 2, md: 2.5 },
        gap: 2,
        display: 'grid',
        borderRadius: 2,
        border: (theme) => `solid 1px ${theme.vars.palette.divider}`,
        opacity: sePuedePedir ? 1 : 0.64,
        // Lo que incluye, en una franja azul a todo lo ancho; debajo, los
        // extras. En el teléfono, todo apilado.
        gridTemplateColumns: { xs: 'auto 1fr', md: 'auto 1fr auto auto' },
        gridTemplateAreas: {
          xs: `"foto datos" "conteo conteo" "cantidad cantidad" "incluye incluye" "extras extras"`,
          md: `"foto datos conteo cantidad" ". incluye incluye incluye" ". extras extras extras"`,
        },
      }}
    >
      <Box sx={{ gridArea: 'foto', position: 'relative', alignSelf: 'start' }}>
        {/* La foto es la del producto en la tienda: cambiarla allí la cambia aquí.
            Sin foto, un cuadro con icono (con `src=""` se vuelve a pedir la página). */}
        {combo.coverUrl ? (
          <Box
            component="img"
            alt={combo.name}
            src={combo.coverUrl}
            sx={{ ...FOTO, display: 'block', objectFit: 'cover' }}
          />
        ) : (
          <Box
            sx={{
              ...FOTO,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'text.disabled',
              bgcolor: 'background.neutral',
            }}
          >
            <Iconify icon="solar:gallery-wide-bold" width={28} />
          </Box>
        )}

        {datos.destacado && (
          <Box
            sx={{
              top: -8,
              right: -8,
              width: 28,
              height: 28,
              display: 'flex',
              borderRadius: '50%',
              position: 'absolute',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: 'warning.main',
              color: 'warning.contrastText',
              boxShadow: (theme) => theme.vars.customShadows.z8,
            }}
          >
            <Iconify icon="solar:medal-star-bold" width={16} />
          </Box>
        )}
      </Box>

      <Box sx={{ gridArea: 'datos', minWidth: 0 }}>
        {!!datos.etiqueta && (
          <Label
            variant="soft"
            color={COLOR_POR_PUESTO[puesto] ?? 'default'}
            sx={{ mb: 0.75, textTransform: 'uppercase' }}
          >
            {datos.etiqueta}
          </Label>
        )}
        {/* El nombre del producto sobra: la etiqueta de arriba ya dice qué combo
            es. Solo sale si el combo no tiene etiqueta, para que se sepa cuál es. */}
        {!datos.etiqueta && <Typography variant="h6">{combo.name}</Typography>}
        {!!combo.subDescription && (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {combo.subDescription}
          </Typography>
        )}
        <Typography variant="h5" sx={{ mt: 0.75 }}>
          {fDopCurrency(combo.price)}
        </Typography>
      </Box>

      <Box sx={{ gridArea: 'conteo', alignSelf: 'start' }}>
        {restante && !cerrado && <ConteoRegresivo restante={restante} />}
      </Box>

      <Box
        sx={{
          gridArea: 'cantidad',
          alignSelf: 'start',
          display: 'flex',
          flexDirection: { xs: 'row', md: 'column' },
          alignItems: { xs: 'center', md: 'flex-end' },
          justifyContent: 'space-between',
          gap: 0.75,
        }}
      >
        {sePuedePedir ? (
          <>
            <NumberInput
              hideDivider
              min={0}
              max={maximo}
              value={cantidad}
              onChange={(event, valor) => onCantidad(valor)}
              sx={{ width: 132 }}
            />
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Disponibles: {maximo}
            </Typography>
          </>
        ) : (
          <Label color="default">{cerrado ? 'Cerrado' : 'Agotado'}</Label>
        )}
      </Box>

      {!!datos.incluye?.length && (
        <Stack
          direction="row"
          sx={{
            gridArea: 'incluye',
            // La franja azul de la casa (los extras van en el mismo azul).
            bgcolor: (theme) => varAlpha(theme.vars.palette.primary.mainChannel, 0.08),
            px: 2,
            py: 1.25,
            rowGap: 1,
            columnGap: 2.5,
            flexWrap: 'wrap',
            borderRadius: 2,
          }}
        >
          {datos.incluye.map((item) => (
            <Stack key={item.texto} direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
              <Iconify
                icon={ICONO_DE_INCLUYE[item.tipo]}
                width={20}
                sx={(theme) => ({ color: theme.vars.palette.primary.main })}
              />
              <Typography variant="body2">{item.texto}</Typography>
              <Iconify icon="eva:checkmark-fill" width={16} sx={{ color: 'success.main' }} />
            </Stack>
          ))}
        </Stack>
      )}

      {!!extras.length && (
        <Box
          sx={{
            gridArea: 'extras',
            gap: 1.5,
            display: 'grid',
            alignSelf: 'start',
            gridTemplateColumns: { xs: '1fr', sm: `repeat(${extras.length}, 1fr)` },
          }}
        >
          {extras.map(({ producto, ...extra }) => (
            <ExtraDelCombo
              key={producto.id}
              extra={extra}
              producto={producto}
              cantidad={cantidadesExtras[`${combo.id}:${producto.id}`] ?? 0}
              conCombo={cantidad > 0}
              onCambiar={(valor) => onExtra(producto.id, valor)}
            />
          ))}
        </Box>
      )}
    </Box>
  );
}
