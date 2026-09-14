import { useMemo } from 'react';
import { varAlpha } from 'minimal-shared/utils';

import { useTheme } from '@mui/material/styles';

// ----------------------------------------------------------------------
// LOS TONOS DE MARCA, SACADOS DEL TEMA.
//
// La pantalla Principal pinta sobre navy —la bienvenida, la proxima actividad, el
// lema—, y ahi el color no se puede heredar: sobre un fondo fijo, heredar del
// tema es justo lo que se rompe al cambiar de claro a oscuro. Hay que escribirlo.
//
// Pero escribirlo NO es inventarlo. Todo esto sale de `theme.vars.palette`:
//
//   - `brand.navy` y `brand.oro` son el escudo, y no cambian con el preset.
//   - `primary` SI cambia con el preset del engranaje, asi que los botones y los
//     acentos de esta pantalla se mueven con el resto de la aplicacion.
//
// Vive como gancho y no como constantes sueltas porque el tema es reactivo: con
// un archivo de literales —como el `paleta-en-pruebas.js` que esto sustituye— la
// pantalla se quedaba con el color de ayer al cambiar de preset.
// ----------------------------------------------------------------------

export function useTonosDeMarca() {
  const theme = useTheme();

  return useMemo(() => {
    const { palette } = theme.vars;

    return {
      NAVY: {
        fondo: palette.brand.navy,
        // El canal —"11 27 54"— es lo que `varAlpha` necesita para hacer un
        // translucido. Sale del tema: `createPaletteChannel` lo genera al
        // registrar `brand`.
        canal: palette.brand.navyChannel,
        claro: palette.brand.navyLight,
        // El texto en reposo sobre navy va azulado, no gris: un gris neutro ahi se
        // ve sucio. La escala del proyecto ya tiene sesgo azul.
        texto: palette.grey[400],
        abierto: varAlpha(palette.common.whiteChannel, 0.08),
        linea: varAlpha(palette.common.whiteChannel, 0.14),
      },
      ORO: {
        principal: palette.brand.oro,
        claro: palette.brand.oroLight,
        velo: palette.brand.oroLighter,
      },
      AZUL: {
        principal: palette.primary.main,
        encima: palette.primary.dark,
        velo: palette.primary.lighter,
        oscuro: palette.primary.darker,
      },
      // Los cuatro acentos de los accesos rapidos. Cada uno con su velo —el fondo
      // de la tarjeta— y su tono de lectura, y los cuatro salen de familias del
      // tema: cambiar el preset los mueve.
      ACENTOS: {
        azul: {
          fondo: palette.primary.main,
          velo: palette.primary.lighter,
          tinta: palette.primary.dark,
        },
        verde: {
          fondo: palette.success.main,
          velo: palette.success.lighter,
          tinta: palette.success.dark,
        },
        ambar: {
          fondo: palette.warning.main,
          velo: palette.warning.lighter,
          tinta: palette.warning.dark,
        },
        morado: {
          fondo: palette.secondary.main,
          velo: palette.secondary.lighter,
          tinta: palette.secondary.dark,
        },
      },
    };
  }, [theme]);
}
