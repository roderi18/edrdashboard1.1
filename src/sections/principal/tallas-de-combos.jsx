'use client';

import { varAlpha } from 'minimal-shared/utils';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import ButtonGroup from '@mui/material/ButtonGroup';

import { fDopCurrency } from 'src/utils/format-number';
import {
  sanearCombo,
  maximoDeCombo,
  maximoDeTalla,
  sumaDelReparto,
  tallasDelCombo,
} from 'src/utils/combos-de-actividad.mjs';

import { Label } from 'src/components/label';
import { Iconify } from 'src/components/iconify';
import { NumberInput } from 'src/components/number-input';

// ----------------------------------------------------------------------
// PASOS 2 Y 3 DE "INSCRIBIRME".
//
// Paso 2, tallas y adicionales: UN recuadro con las tallas de todas las
// camisetas de los combos elegidos (son iguales en todos los combos: antes salía
// uno por combo y había que repartir las mismas camisetas dos veces), y debajo
// las camisetas y los parches adicionales, cerrados hasta que se responde "Sí".
//
// Paso 3, resumen: lo que irá al carrito, línea por línea, con sus tallas.
//
// Las cuentas son de `src/utils/combos-de-actividad.mjs`; aquí solo se pinta.
// ----------------------------------------------------------------------

const nombreDelCombo = (combo) => sanearCombo(combo.combo)?.etiqueta || combo.name;

// UNA TALLA POR RENGLÓN; la que tiene alguna asignada se resalta.
function RenglonDeTalla({ talla, cantidad, maximo, onCambiar, compacto = false }) {
  return (
    <Stack
      direction="row"
      sx={(theme) => ({
        px: 1.25,
        py: compacto ? 0.5 : 0.75,
        alignItems: 'center',
        justifyContent: 'space-between',
        borderRadius: 1.25,
        border: `solid 1px ${
          cantidad > 0 ? theme.vars.palette.primary.main : theme.vars.palette.divider
        }`,
        bgcolor:
          cantidad > 0 ? varAlpha(theme.vars.palette.primary.mainChannel, 0.06) : 'transparent',
      })}
    >
      <Typography
        variant="subtitle2"
        sx={{ color: cantidad > 0 ? 'primary.main' : 'text.primary' }}
      >
        Talla {talla}
      </Typography>
      <NumberInput
        hideDivider
        min={0}
        max={maximo}
        value={cantidad}
        onChange={(event, valor) => onCambiar(talla, valor)}
        sx={{ width: 112 }}
      />
    </Stack>
  );
}

// LAS TALLAS EN DOS COLUMNAS EN PANTALLA GRANDE: a la izquierda las de niño (las
// de número, 6 a 16) y a la derecha las de adulto (S a XXL). En una sola columna
// las once hacían un recuadro larguísimo. En el teléfono, una debajo de otra.
const esTallaDeNumero = (talla) => /^\d+$/.test(String(talla).trim());

function ListaDeTallas({ tallas, reparto, maximoDe, onCambiar, compacto }) {
  const deNino = tallas.filter(esTallaDeNumero);
  const deAdulto = tallas.filter((talla) => !esTallaDeNumero(talla));
  const columnas = [deNino, deAdulto].filter((grupo) => grupo.length);

  return (
    <Box
      sx={{
        gap: compacto ? 0.5 : 0.75,
        display: 'grid',
        alignItems: 'start',
        gridTemplateColumns: {
          xs: '1fr',
          md: `repeat(${columnas.length}, minmax(0, 1fr))`,
        },
      }}
    >
      {columnas.map((grupo) => (
        <Stack key={grupo[0]} spacing={compacto ? 0.5 : 0.75}>
          {grupo.map((talla) => (
            <RenglonDeTalla
              key={talla}
              compacto={compacto}
              talla={talla}
              cantidad={reparto[talla] ?? 0}
              maximo={maximoDe(talla)}
              onCambiar={onCambiar}
            />
          ))}
        </Stack>
      ))}
    </Box>
  );
}

/** Las tallas de las camisetas de los combos: un solo recuadro para todas. */
function TallasDeLosCombos({ estado, reparto, onCambiar, compacto }) {
  const { filas, unidades, faltan, completo } = estado;

  return (
    <Box
      sx={{
        p: compacto ? 1.75 : 2,
        borderRadius: 2,
        border: (theme) =>
          completo
            ? `solid 1px ${theme.vars.palette.divider}`
            : `solid 1.5px ${theme.vars.palette.warning.main}`,
      }}
    >
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: 1.5 }}>
        <Iconify icon="custom:categoria-camisetas" width={28} sx={{ color: 'primary.main' }} />
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography variant="subtitle2">Camisetas de tus combos ({unidades})</Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {filas.map(({ combo, unidades: n }) => `${nombreDelCombo(combo)} × ${n}`).join(' · ')}
          </Typography>
        </Box>
        {completo ? (
          <Label color="success" startIcon={<Iconify icon="solar:check-circle-bold" />}>
            {unidades} de {unidades}
          </Label>
        ) : (
          <Label color="warning" startIcon={<Iconify icon="solar:danger-triangle-linear" />}>
            Falta{faltan === 1 ? '' : 'n'} {faltan}
          </Label>
        )}
      </Stack>

      <ListaDeTallas
        compacto={compacto}
        tallas={estado.tallas}
        reparto={reparto}
        maximoDe={(talla) => maximoDeTalla({ unidades, reparto, talla })}
        onCambiar={onCambiar}
      />
    </Box>
  );
}

/**
 * Un adicional con pago aparte, CERRADO hasta que se responde "Sí": once tallas
 * abiertas de golpe llenaban la pantalla a quien no quería ninguna. "No" lo
 * cierra y borra lo elegido.
 */
function RecuadroAdicional({
  icono,
  pregunta,
  producto,
  abierto,
  onAbrir,
  resumen,
  children,
  compacto,
}) {
  const precio = Number(producto.price) || 0;

  return (
    <Box
      sx={(theme) => ({
        p: compacto ? 1.75 : 2,
        borderRadius: 2,
        border: `dashed 1px ${theme.vars.palette.primary.main}`,
        bgcolor: varAlpha(theme.vars.palette.primary.mainChannel, 0.04),
      })}
    >
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
        <Iconify icon={icono} width={28} sx={{ color: 'primary.main', flexShrink: 0 }} />
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography variant="subtitle2">{pregunta}</Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Pago adicional · {fDopCurrency(precio)} c/u
          </Typography>
        </Box>
        {abierto && resumen}
        <ButtonGroup size="small" sx={{ flexShrink: 0 }}>
          <Button
            variant={abierto ? 'outlined' : 'contained'}
            color={abierto ? 'inherit' : 'primary'}
            onClick={() => onAbrir(false)}
          >
            No
          </Button>
          <Button
            variant={abierto ? 'contained' : 'outlined'}
            color={abierto ? 'primary' : 'inherit'}
            onClick={() => onAbrir(true)}
          >
            Sí
          </Button>
        </ButtonGroup>
      </Stack>

      {abierto && <Box sx={{ mt: 1.5 }}>{children}</Box>}
    </Box>
  );
}

function CamisetasAdicionales({ producto, reparto, abierto, onAbrir, onCambiar, compacto }) {
  const precio = Number(producto.price) || 0;
  const unidades = sumaDelReparto(reparto);
  const existencias = maximoDeCombo(producto);

  return (
    <RecuadroAdicional
      compacto={compacto}
      icono="custom:categoria-camisetas"
      pregunta="¿Quieres camisetas adicionales?"
      producto={producto}
      abierto={abierto}
      onAbrir={onAbrir}
      resumen={
        unidades > 0 && (
          <Label color="primary">
            {unidades} × {fDopCurrency(precio)} = {fDopCurrency(precio * unidades)}
          </Label>
        )
      }
    >
      <ListaDeTallas
        compacto={compacto}
        tallas={tallasDelCombo(producto)}
        reparto={reparto}
        // Sin el tope de los combos: solo lo que haya en existencia.
        maximoDe={(talla) => (reparto[talla] ?? 0) + Math.max(0, existencias - unidades)}
        onCambiar={onCambiar}
      />
    </RecuadroAdicional>
  );
}

function ParchesAdicionales({ producto, cantidad, abierto, onAbrir, onCambiar, compacto }) {
  const precio = Number(producto.price) || 0;

  return (
    <RecuadroAdicional
      compacto={compacto}
      icono="custom:categoria-parches"
      pregunta="¿Quieres parches adicionales?"
      producto={producto}
      abierto={abierto}
      onAbrir={onAbrir}
      resumen={
        cantidad > 0 && (
          <Label color="primary">
            {cantidad} × {fDopCurrency(precio)} = {fDopCurrency(precio * cantidad)}
          </Label>
        )
      }
    >
      <Stack
        direction="row"
        sx={{ px: 1.25, alignItems: 'center', justifyContent: 'space-between' }}
      >
        <Typography variant="subtitle2">{producto.name}</Typography>
        <NumberInput
          hideDivider
          min={0}
          max={maximoDeCombo(producto)}
          value={cantidad}
          onChange={(event, valor) => onCambiar(valor)}
          sx={{ width: 112 }}
        />
      </Stack>
    </RecuadroAdicional>
  );
}

export function PasoDeTallas({ estilo, estado, tallas, onCambiarTalla, camiseta, parche }) {
  const compacto = estilo === '2';

  return (
    <Stack spacing={compacto ? 1.5 : 2}>
      {estado.hacenFalta && (
        <TallasDeLosCombos
          compacto={compacto}
          estado={estado}
          reparto={tallas}
          onCambiar={onCambiarTalla}
        />
      )}

      {camiseta.producto && (
        <CamisetasAdicionales
          compacto={compacto}
          producto={camiseta.producto}
          reparto={camiseta.reparto}
          abierto={camiseta.abierto}
          onAbrir={camiseta.onAbrir}
          onCambiar={camiseta.onCambiar}
        />
      )}

      {parche.producto && (
        <ParchesAdicionales
          compacto={compacto}
          producto={parche.producto}
          cantidad={parche.cantidad}
          abierto={parche.abierto}
          onAbrir={parche.onAbrir}
          onCambiar={parche.onCambiar}
        />
      )}
    </Stack>
  );
}

// ----------------------------------------------------------------------

/** "M×2 · L×1" como etiquetas sueltas: igual en el resumen y en el carrito. */
export function TallasDeLaLinea({ texto }) {
  return (
    <Stack
      direction="row"
      spacing={0.5}
      sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 0.5 }}
    >
      <Iconify icon="custom:categoria-camisetas" width={14} sx={{ color: 'text.secondary' }} />
      {String(texto)
        .split(' · ')
        .filter(Boolean)
        .map((pieza) => (
          <Label key={pieza} variant="soft" color="primary">
            {pieza}
          </Label>
        ))}
    </Stack>
  );
}

/**
 * EL RESUMEN DEL PASO 3: lo que irá al carrito, tal cual se verá allí —nombre,
 * tallas, cantidad, precio y subtotal— y el total. Nada se agrega hasta pulsar.
 */
export function ResumenDelPedido({ items, total }) {
  return (
    <Box sx={{ borderRadius: 2, border: (theme) => `solid 1px ${theme.vars.palette.divider}` }}>
      <Stack divider={<Divider flexItem />}>
        {items.map((item) => (
          <Stack
            key={item.id}
            direction="row"
            spacing={2}
            sx={{ px: 2, py: 1.5, alignItems: 'center' }}
          >
            {item.coverUrl ? (
              <Box
                component="img"
                alt={item.name}
                src={item.coverUrl}
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: 1.25,
                  objectFit: 'cover',
                  flexShrink: 0,
                }}
              />
            ) : (
              <Box
                sx={{
                  width: 48,
                  height: 48,
                  flexShrink: 0,
                  display: 'grid',
                  placeItems: 'center',
                  borderRadius: 1.25,
                  color: 'text.disabled',
                  bgcolor: 'background.neutral',
                }}
              >
                <Iconify icon="solar:box-minimalistic-bold" width={22} />
              </Box>
            )}

            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              <Typography variant="subtitle2" noWrap>
                {item.name}
              </Typography>
              <Stack
                direction="row"
                spacing={1}
                sx={{ mt: 0.25, alignItems: 'center', flexWrap: 'wrap', rowGap: 0.5 }}
              >
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {item.quantity} × {fDopCurrency(item.price)}
                </Typography>
                {!!item.size && <TallasDeLaLinea texto={item.size} />}
              </Stack>
            </Box>

            <Typography variant="subtitle2" sx={{ flexShrink: 0 }}>
              {fDopCurrency(item.subtotal)}
            </Typography>
          </Stack>
        ))}
      </Stack>

      <Stack
        direction="row"
        sx={{
          px: 2,
          py: 1.5,
          alignItems: 'center',
          justifyContent: 'space-between',
          bgcolor: 'background.neutral',
          borderTop: (theme) => `solid 1px ${theme.vars.palette.divider}`,
        }}
      >
        <Typography variant="subtitle2">Total</Typography>
        <Typography variant="h6">{fDopCurrency(total)}</Typography>
      </Stack>
    </Box>
  );
}

// ----------------------------------------------------------------------

const PASOS = ['Combos', 'Tallas y adicionales', 'Resumen'];

function PasoDelIndicador({ numero, texto, paso }) {
  const hecho = paso > numero;
  const actual = paso === numero;

  return (
    <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
      <Box
        sx={{
          width: 22,
          height: 22,
          display: 'grid',
          borderRadius: '50%',
          placeItems: 'center',
          typography: 'caption',
          fontWeight: 700,
          ...(hecho && { bgcolor: 'success.lighter', color: 'success.dark' }),
          ...(actual && { bgcolor: 'primary.main', color: 'primary.contrastText' }),
          ...(!hecho && !actual && { bgcolor: 'background.neutral', color: 'text.disabled' }),
        }}
      >
        {hecho ? <Iconify icon="eva:checkmark-fill" width={14} /> : numero}
      </Box>
      <Typography
        variant="body2"
        sx={{
          fontWeight: actual ? 600 : 400,
          color: hecho ? 'success.dark' : actual ? 'text.primary' : 'text.disabled',
        }}
      >
        {texto}
      </Typography>
    </Stack>
  );
}

/** "✓ Combos ─ ② Tallas y adicionales ─ ③ Resumen". Sin paso 2, solo 1 y 3. */
export function PasosDeInscripcion({ paso, conPaso2 = true }) {
  const pasos = PASOS.map((texto, indice) => ({ texto, numero: indice + 1 })).filter(
    ({ numero }) => conPaso2 || numero !== 2
  );

  return (
    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 1 }}>
      {pasos.map(({ texto, numero }, indice) => (
        <Stack key={numero} direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
          {indice > 0 && <Box sx={{ width: 32, height: '1px', bgcolor: 'divider' }} />}
          <PasoDelIndicador numero={numero} texto={texto} paso={paso} />
        </Stack>
      ))}
    </Stack>
  );
}
