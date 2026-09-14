import { CONFIG } from 'src/global-config';
import { themeConfig } from 'src/theme/theme-config';

// ----------------------------------------------------------------------

export const SETTINGS_STORAGE_KEY = 'app-settings';

export const defaultSettings = {
  mode: themeConfig.defaultMode,
  direction: themeConfig.direction,
  contrast: 'default',
  navLayout: 'vertical',
  primaryColor: 'default',
  // 'apparent' es la barra oscura. En pruebas se deja por defecto para ver el
  // navy; 'integrate' la devuelve al color del fondo.
  navColor: 'apparent',
  compactLayout: true,
  fontSize: 16,
  fontFamily: themeConfig.fontFamily.primary,
  version: CONFIG.appVersion,
};
