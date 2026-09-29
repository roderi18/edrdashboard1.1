import 'src/global.css';

import InitColorSchemeScript from '@mui/material/InitColorSchemeScript';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v16-appRouter';

import { I18nProvider } from 'src/locales/i18n-provider';
import { fallbackLng, LocalizationProvider } from 'src/locales';
import { themeConfig, ThemeProvider, primary as primaryColor } from 'src/theme';

import { Snackbar } from 'src/components/snackbar';
import { defaultSettings, SettingsProvider } from 'src/components/settings';

// ----------------------------------------------------------------------
// La landing usa el MISMO tema y los mismos proveedores que el dashboard
// (colores, tipografía, fechas en español, avisos), pero nada más: sin sesión,
// sin menús y sin rutas de la aplicación.
// ----------------------------------------------------------------------

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: primaryColor.main,
};

export const metadata = {
  title: 'Registro de Destacamentos | Exploradores del Rey',
  description:
    'Registra o actualiza la información de tu destacamento de Exploradores del Rey en República Dominicana.',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }) {
  return (
    <html lang={fallbackLng} suppressHydrationWarning>
      <body>
        <InitColorSchemeScript
          modeStorageKey={themeConfig.modeStorageKey}
          attribute={themeConfig.cssVariables.colorSchemeSelector}
          defaultMode="light"
        />
        <I18nProvider lang={fallbackLng}>
          <SettingsProvider defaultSettings={{ ...defaultSettings, mode: 'light' }}>
            <LocalizationProvider>
              <AppRouterCacheProvider options={{ key: 'css' }}>
                <ThemeProvider modeStorageKey={themeConfig.modeStorageKey} defaultMode="light">
                  <Snackbar />
                  {children}
                </ThemeProvider>
              </AppRouterCacheProvider>
            </LocalizationProvider>
          </SettingsProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
