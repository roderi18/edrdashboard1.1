'use client';

import { useMemo, useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Divider from '@mui/material/Divider';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';

import { fDopCurrency } from 'src/utils/format-number';
import {
  maximoDeCombo,
  combosDeActividad,
  itemDeCarritoDeCombo,
} from 'src/utils/combos-de-actividad.mjs';

import { useGetProducts } from 'src/actions/product';

import { Label } from 'src/components/label';
import { toast } from 'src/components/snackbar';
import { NumberInput } from 'src/components/number-input';

import { useCheckoutContext } from 'src/sections/checkout/context';

// ----------------------------------------------------------------------
// "INSCRIBIRME" EN UNA ACTIVIDAD = COMPRAR SUS COMBOS.
//
// Salen los combos del campamento (productos de la tienda con la categoría que
// se llama como la actividad; regla en `src/utils/combos-de-actividad.mjs`), se
// elige cuántos de cada uno —más de uno para inscribir a más personas— y van al
// carrito de siempre: misma orden, pago y recibo que cualquier compra.
//
// Sin combos, el botón de la tarjeta lleva a su enlace de siempre: este diálogo
// solo se abre cuando la tienda ya tiene la categoría de la actividad.
// ----------------------------------------------------------------------

export function InscripcionActividadDialog({ abierto, onCerrar, actividad, destinoSinCombos }) {
  const router = useRouter();
  const { onAddToCart } = useCheckoutContext();
  const { products, productsLoading } = useGetProducts();
  const [cantidades, setCantidades] = useState({});

  const combos = useMemo(
    () => combosDeActividad(products, actividad?.titulo),
    [products, actividad?.titulo]
  );

  // Sin combos en la tienda, el botón hace lo de siempre: su enlace.
  useEffect(() => {
    if (abierto && !productsLoading && !combos.length) {
      onCerrar();
      router.push(destinoSinCombos);
    }
  }, [abierto, productsLoading, combos.length, onCerrar, router, destinoSinCombos]);

  useEffect(() => {
    if (!abierto) setCantidades({});
  }, [abierto]);

  const elegidos = combos.filter((combo) => (cantidades[combo.id] ?? 0) > 0);
  const total = elegidos.reduce(
    (suma, combo) => suma + (Number(combo.price) || 0) * cantidades[combo.id],
    0
  );
  const personas = elegidos.reduce((suma, combo) => suma + cantidades[combo.id], 0);

  const agregarAlCarrito = () => {
    elegidos.forEach((combo) => onAddToCart(itemDeCarritoDeCombo(combo, cantidades[combo.id])));
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
      maxWidth="sm"
    >
      <DialogTitle>
        Inscribirme · {actividad?.titulo}
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
          Elige tu combo. Puedes llevar más de uno para inscribir a otras personas.
        </Typography>
      </DialogTitle>

      <DialogContent dividers>
        {productsLoading && (
          <Stack spacing={2}>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} variant="rounded" height={88} />
            ))}
          </Stack>
        )}

        {!productsLoading && (
          <Stack divider={<Divider flexItem />} spacing={2}>
            {combos.map((combo) => {
              const maximo = maximoDeCombo(combo);
              const cantidad = cantidades[combo.id] ?? 0;

              return (
                <Stack key={combo.id} direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                  <Box
                    component="img"
                    alt={combo.name}
                    src={combo.coverUrl}
                    sx={{
                      width: 72,
                      height: 72,
                      flexShrink: 0,
                      borderRadius: 1.5,
                      objectFit: 'cover',
                      bgcolor: 'background.neutral',
                    }}
                  />

                  <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                    <Typography variant="subtitle2">{combo.name}</Typography>
                    {!!combo.subDescription && (
                      <Typography
                        variant="caption"
                        sx={(theme) => ({
                          color: 'text.secondary',
                          ...theme.mixins.maxLine({ line: 2 }),
                        })}
                      >
                        {combo.subDescription}
                      </Typography>
                    )}
                    <Typography variant="subtitle1" sx={{ mt: 0.5 }}>
                      {fDopCurrency(combo.price)}
                    </Typography>
                  </Box>

                  {maximo > 0 ? (
                    <Box sx={{ width: 110, flexShrink: 0, textAlign: 'right' }}>
                      <NumberInput
                        hideDivider
                        min={0}
                        max={maximo}
                        value={cantidad}
                        onChange={(event, valor) =>
                          setCantidades((actual) => ({ ...actual, [combo.id]: valor }))
                        }
                      />
                      <Typography
                        variant="caption"
                        sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}
                      >
                        disponibles: {maximo}
                      </Typography>
                    </Box>
                  ) : (
                    <Label color="default">Agotado</Label>
                  )}
                </Stack>
              );
            })}
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{ justifyContent: 'space-between' }}>
        <Typography variant="subtitle1">
          {personas > 0 ? `Total: ${fDopCurrency(total)}` : ''}
        </Typography>

        <Stack direction="row" spacing={1}>
          <Button color="inherit" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button variant="contained" disabled={!personas} onClick={agregarAlCarrito}>
            {personas > 1 ? `Agregar ${personas} al carrito` : 'Agregar al carrito'}
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
}
