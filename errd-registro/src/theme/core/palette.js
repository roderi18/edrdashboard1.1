import { varAlpha, createPaletteChannel } from 'minimal-shared/utils';

import { opacity } from './opacity';
import { themeConfig } from '../theme-config';

// ----------------------------------------------------------------------

/**
 * ➤
 * ➤ ➤ Core palette (primary, secondary, info, success, warning, error, common, grey)
 * ➤
 */
export const primary = createPaletteChannel(themeConfig.palette.primary);
export const secondary = createPaletteChannel(themeConfig.palette.secondary);
export const info = createPaletteChannel(themeConfig.palette.info);
export const success = createPaletteChannel(themeConfig.palette.success);
export const warning = createPaletteChannel(themeConfig.palette.warning);
export const error = createPaletteChannel(themeConfig.palette.error);
export const common = createPaletteChannel(themeConfig.palette.common);
export const grey = createPaletteChannel(themeConfig.palette.grey);
// EL ESCUDO: navy y oro. Pasa por `createPaletteChannel` como las demas para que
// tenga sus `*Channel`, que es lo que `varAlpha` necesita para hacer un
// translucido —la barra lateral usa `brand.navyChannel`—.
export const brand = createPaletteChannel(themeConfig.palette.brand);

/**
 * ➤
 * ➤ ➤ Text, background, action
 * ➤
 */
export const text = {
  // `disabled2`: gris para el texto de campos deshabilitados legibles. Es un poco
  // más oscuro/contrastado que `disabled` (en oscuro, más claro para contraste).
  light: createPaletteChannel({
    primary: grey[800],
    secondary: grey[600],
    disabled: grey[500],
    disabled2: '#2E363E',
  }),
  dark: createPaletteChannel({
    primary: '#FFFFFF',
    secondary: grey[500],
    disabled: grey[600],
    disabled2: grey[400],
  }),
};

// EL OSCURO ES NAVY, NO GRIS.
//
// Eran grises neutros (`#1C252E` y `#141A21`). Junto al navy de la barra lateral
// —que es mobiliario de marca y no sigue al tema— se veian apagados y sucios,
// como dos oscuros distintos peleando en la misma pantalla. Ahora llevan el mismo
// sesgo azul que la barra y el panel deja de parecer dos aplicaciones pegadas.
//
// Salen de la escala de grises, que ya esta girada hacia el azul: asi un ajuste
// de la escala mueve los fondos con ella y no se quedan a medio camino.
export const background = {
  light: createPaletteChannel({ paper: '#FFFFFF', default: '#FFFFFF', neutral: grey[200] }),
  dark: createPaletteChannel({ paper: grey[800], default: grey[900], neutral: '#243350' }),
};

export const action = (mode) => ({
  active: mode === 'light' ? grey[600] : grey[500],
  hover: varAlpha(grey['500Channel'], 0.08),
  selected: varAlpha(grey['500Channel'], 0.16),
  focus: varAlpha(grey['500Channel'], 0.24),
  disabled: varAlpha(grey['500Channel'], 0.8),
  disabledBackground: varAlpha(grey['500Channel'], 0.24),
  hoverOpacity: 0.08,
  selectedOpacity: 0.08,
  focusOpacity: 0.12,
  activatedOpacity: 0.12,
  disabledOpacity: 0.48,
});

/**
 * ➤
 * ➤ ➤ Extended palette
 * ➤
 */
export const extendPalette = {
  shared: {
    inputUnderline: varAlpha(grey['500Channel'], opacity.inputUnderline),
    inputOutlined: varAlpha(grey['500Channel'], 0.2),
    paperOutlined: varAlpha(grey['500Channel'], 0.16),
    buttonOutlined: varAlpha(grey['500Channel'], 0.32),
  },
};

/**
 * ➤
 * ➤ ➤ Base configuration
 * ➤
 */
const basePalette = {
  primary,
  secondary,
  info,
  success,
  warning,
  error,
  common,
  grey,
  // Va en la base y no en `light`/`dark`: el escudo es el mismo en los dos modos.
  brand,
  divider: varAlpha(grey['500Channel'], 0.2),
  TableCell: { border: varAlpha(grey['500Channel'], 0.2) },
  ...extendPalette,
};

/* **********************************************************************
 * 📦 Final
 * **********************************************************************/
export const palette = {
  light: {
    ...basePalette,
    text: text.light,
    background: background.light,
    action: action('light'),
  },
  dark: {
    ...basePalette,
    text: text.dark,
    background: background.dark,
    action: action('dark'),
  },
};

export const colorKeys = {
  palette: ['primary', 'secondary', 'info', 'success', 'warning', 'error'],
  common: ['black', 'white'],
};
