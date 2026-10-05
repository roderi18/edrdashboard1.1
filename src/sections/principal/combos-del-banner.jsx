'use client';

import { useMemo } from 'react';
import { varAlpha } from 'minimal-shared/utils';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ButtonBase from '@mui/material/ButtonBase';

import { fDopCurrency } from 'src/utils/format-number';
import { sanearCombo, tiempoRestante, combosDeActividad } from 'src/utils/combos-de-actividad.mjs';

import { useGetProducts } from 'src/actions/product';

import { Iconify } from 'src/components/iconify';

const MAXIMO_EN_EL_BANNER = 3;

/** Los combos de la actividad, leídos de la tienda. Solo en /principal. */
export function useCombosDelBanner(actividad) {
  const { products } = useGetProducts();

  return useMemo(
    () =>
      combosDeActividad(products, actividad?.titulo, actividad?.categoriaCombos).slice(
        0,
        MAXIMO_EN_EL_BANNER
      ),
    [products, actividad?.titulo, actividad?.categoriaCombos]
  );
}

const textoDeCierre = (restante) => {
  if (restante.cerrado) return 'Cerrado';
  if (restante.dias >= 1) return `${restante.dias} ${restante.dias === 1 ? 'día' : 'días'}`;
  if (restante.horas >= 1) return `${restante.horas} h`;

  return `${Math.max(1, restante.minutos)} min`;
};

const estiloDelCombo = (nombre) => {
  if (/plus/i.test(nombre)) return { icono: 'custom:combo-crown', color: '#F5C542' };
  if (/completo/i.test(nombre)) return { icono: 'solar:shield-check-bold', color: '#3985F6' };
  return { icono: 'custom:combo-sprout', color: '#27C76F' };
};

function ComboEnLaFranja({ combo, onAbrir }) {
  const datos = sanearCombo(combo.combo) ?? {};
  const nombre = datos.etiqueta || combo.name;
  const nombreCorto = nombre.replace(/^Combo\s+/i, '');
  const { icono, color } = estiloDelCombo(nombreCorto);
  const restante = tiempoRestante(datos.finVenta);
  const sinPrecio = combo.precioPendiente || !Number(combo.price);

  return (
    <ButtonBase
      onClick={onAbrir}
      aria-label={`${nombre}. ${sinPrecio ? 'Ver precio' : fDopCurrency(combo.price)}${restante ? `. Cierra en ${textoDeCierre(restante)}` : ''}`}
      sx={(theme) => ({
        px: { xs: 1, sm: 1.5, md: 2, lg: 1.25, xl: 2 },
        py: { xs: 0.75, sm: 0.25, md: 0 },
        minWidth: 0,
        width: 1,
        height: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        justifyContent: 'center',
        textAlign: 'left',
        color: '#FFFFFF',
        borderTop: {
          xs: `1px solid ${varAlpha(theme.vars.palette.common.whiteChannel, 0.18)}`,
          sm: 0,
        },
        borderLeft: { sm: `1px solid ${varAlpha(theme.vars.palette.common.whiteChannel, 0.22)}` },
        '&:hover': { bgcolor: varAlpha(theme.vars.palette.common.whiteChannel, 0.08) },
      })}
    >
      <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0, width: 1 }}>
        <Iconify icon={icono} width={20} sx={{ color, width: { lg: 17, xl: 20 } }} />
        <Typography
          variant="subtitle1"
          noWrap
          sx={{ fontSize: { xs: 14, md: 14, lg: 11, xl: 15 }, fontWeight: 700 }}
        >
          {nombreCorto}
        </Typography>
      </Stack>
      <Box sx={{ pl: { xs: 3.5, lg: 3, xl: 3.5 }, minWidth: 0 }}>
        {/* El precio es el del producto: el editor visual del Designer lo
            reconoce por esta marca y lo cambia en la tienda, no lo tapa con un
            texto (antes la portada decía un precio y el carrito cobraba otro). */}
        <Typography
          noWrap
          data-precio-producto={combo.id}
          data-precio-actual={Number(combo.price) || 0}
          data-precio-nombre={nombre}
          sx={{ fontSize: { xs: 16, md: 17, lg: 13, xl: 18 }, lineHeight: 1.2, fontWeight: 700 }}
        >
          {sinPrecio ? 'Ver precio' : fDopCurrency(combo.price)}
        </Typography>
        {restante && (
          <Stack
            direction="row"
            spacing={0.5}
            alignItems="center"
            sx={{ color: 'rgba(255,255,255,.75)', mt: 0.25 }}
          >
            <Iconify
              icon="solar:clock-circle-outline"
              width={15}
              sx={{ width: { lg: 13, xl: 15 } }}
            />
            <Typography
              noWrap
              variant="caption"
              sx={{ fontSize: { xs: 11, md: 11, lg: 9, xl: 12 } }}
            >
              Cierra en {textoDeCierre(restante)}
            </Typography>
          </Stack>
        )}
      </Box>
    </ButtonBase>
  );
}

export function CombosDelBanner({ combos, onAbrir }) {
  return combos.map((combo) => <ComboEnLaFranja key={combo.id} combo={combo} onAbrir={onAbrir} />);
}
