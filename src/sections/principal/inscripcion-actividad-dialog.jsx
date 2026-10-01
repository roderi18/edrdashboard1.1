'use client';

import { useMemo, useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';

import { fDopCurrency } from 'src/utils/format-number';
import {
  sanearCombo,
  extrasDelCombo,
  pedidoDeCombos,
  combosDeActividad,
} from 'src/utils/combos-de-actividad.mjs';

import { azulLegible } from 'src/theme/azul-legible';
import { useGetProducts } from 'src/actions/product';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';

import { useCheckoutContext } from 'src/sections/checkout/context';

import { ComboDeActividad } from './combo-de-actividad';

// ----------------------------------------------------------------------
// "INSCRIBIRME" EN UNA ACTIVIDAD = COMPRAR SUS COMBOS.
//
// Salen los combos del campamento (productos de la tienda con la categoría que
// se llama como la actividad; regla en `src/utils/combos-de-actividad.mjs`), se
// elige cuántos de cada uno —más de uno para inscribir a más personas—, sus
// extras opcionales, y todo va al carrito de siempre: misma orden, pago y recibo
// que cualquier compra.
//
// Sin combos, el botón de la tarjeta lleva a su enlace de siempre: este diálogo
// solo se abre cuando la tienda ya tiene la categoría de la actividad.
// ----------------------------------------------------------------------

// Un solo reloj para todos los conteos, y solo mientras el diálogo está abierto
// y algún combo tiene fecha de cierre: tres relojes por separado se desfasaban.
function useAhora(activo) {
  const [ahora, setAhora] = useState(() => Date.now());

  useEffect(() => {
    if (!activo) return undefined;

    setAhora(Date.now());
    const reloj = setInterval(() => setAhora(Date.now()), 1000);

    return () => clearInterval(reloj);
  }, [activo]);

  return ahora;
}

export function InscripcionActividadDialog({ abierto, onCerrar, actividad, destinoSinCombos }) {
  const router = useRouter();
  const { onAddToCart } = useCheckoutContext();
  const { products, productsLoading } = useGetProducts();
  const [cantidades, setCantidades] = useState({});
  const [extrasMarcados, setExtrasMarcados] = useState({});

  const combos = useMemo(
    () => combosDeActividad(products, actividad?.titulo),
    [products, actividad?.titulo]
  );
  const ahora = useAhora(abierto && combos.some((combo) => sanearCombo(combo.combo)?.finVenta));

  // Sin combos en la tienda, el botón hace lo de siempre: su enlace.
  useEffect(() => {
    if (abierto && !productsLoading && !combos.length) {
      onCerrar();
      router.push(destinoSinCombos);
    }
  }, [abierto, productsLoading, combos.length, onCerrar, router, destinoSinCombos]);

  // Se abre siempre en cero: empezar con uno de cada llevaba a comprar de más
  // sin darse cuenta.
  useEffect(() => {
    if (!abierto) {
      setCantidades({});
      setExtrasMarcados({});
    }
  }, [abierto]);

  const { items, personas, total } = pedidoDeCombos({
    combos,
    productos: products,
    cantidades,
    extrasMarcados,
  });

  const agregarAlCarrito = () => {
    items.forEach((item) => onAddToCart(item));
    toast.success(
      personas === 1 ? 'Combo agregado al carrito.' : `${personas} combos agregados al carrito.`
    );
    onCerrar();
    router.push(paths.dashboard.checkout);
  };

  return (
    <Dialog
      open={abierto && (productsLoading || combos.length > 0)}
      onClose={onCerrar}
      fullWidth
      maxWidth="lg"
      slotProps={{
        paper: { sx: { width: 'calc(100% - 32px)', maxWidth: 1280, borderRadius: 2.5 } },
      }}
    >
      <DialogTitle sx={{ pb: 2 }}>
        <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
          <Box
            sx={(theme) => ({
              width: 52,
              height: 52,
              flexShrink: 0,
              display: { xs: 'none', sm: 'flex' },
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 2,
              bgcolor: 'background.neutral',
              ...azulLegible(theme),
            })}
          >
            <Iconify icon="custom:categoria-campamentos" width={30} />
          </Box>

          <Box>
            <Typography variant="h5" sx={(theme) => azulLegible(theme)}>
              Inscribirme · {actividad?.titulo}
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.25 }}>
              Elige tu combo. Puedes llevar más de uno para inscribir a otras personas.
            </Typography>
          </Box>
        </Stack>
      </DialogTitle>

      <DialogContent dividers sx={{ px: { xs: 2, sm: 3 }, py: 2.5 }}>
        {productsLoading && (
          <Stack spacing={2}>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} variant="rounded" height={150} />
            ))}
          </Stack>
        )}

        {!productsLoading && (
          <Stack spacing={2}>
            {combos.map((combo, puesto) => (
              <ComboDeActividad
                key={combo.id}
                combo={combo}
                puesto={puesto}
                ahora={ahora}
                cantidad={cantidades[combo.id] ?? 0}
                onCantidad={(valor) =>
                  setCantidades((actual) => ({ ...actual, [combo.id]: valor }))
                }
                extras={extrasDelCombo(combo, products)}
                extrasMarcados={extrasMarcados}
                onExtra={(idExtra, marcado) =>
                  setExtrasMarcados((actual) => ({
                    ...actual,
                    [`${combo.id}:${idExtra}`]: marcado,
                  }))
                }
              />
            ))}
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{ px: { xs: 2, sm: 3 }, py: 2, justifyContent: 'space-between' }}>
        <Typography variant="h6">{personas > 0 ? `Total: ${fDopCurrency(total)}` : ''}</Typography>

        <Stack direction="row" spacing={1}>
          <Button color="inherit" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button size="large" variant="contained" disabled={!personas} onClick={agregarAlCarrito}>
            {personas > 1 ? `Agregar ${personas} al carrito` : 'Agregar al carrito'}
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
}
