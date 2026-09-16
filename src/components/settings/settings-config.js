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
  // La barra lateral y la cabecera en blanco, como en la plantilla. Apagado: la
  // casa las quiere en navy. Se enciende desde el panel de ajustes.
  navBlanco: false,
  // Los cuatro accesos rapidos de la pantalla Principal (Registrar actividad,
  // Proxima actividad, Mis insignias, Capacitacion). Encendidos por defecto: son
  // atajos, y quien no los use los apaga desde el panel de ajustes.
  //
  // Quien lea este ajuste tiene que preguntar por `!== false` y no por su valor:
  // las sesiones que guardaron sus ajustes antes de que existiera esta clave no
  // la tienen, y con ellas `undefined` significa "encendido".
  accesosRapidos: true,
  compactLayout: true,
  fontSize: 16,
  fontFamily: themeConfig.fontFamily.primary,
  version: CONFIG.appVersion,
};
